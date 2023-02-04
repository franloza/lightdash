import {
    CreateSnowflakeCredentials,
    DimensionType,
    isWeekDay,
    ParseError,
    WarehouseConnectionError,
    WarehouseQueryError,
    WeekDay,
} from '@lightdash/common';
import * as crypto from 'crypto';
import * as duck from 'duckdb';
import * as Util from 'util';
import { WarehouseCatalog, WarehouseClient } from '../types';

export enum DuckdbTypes {
    NUMBER = 'NUMBER',
    DECIMAL = 'DECIMAL',
    NUMERIC = 'NUMERIC',
    INTEGER = 'INTEGER',
    INT = 'INT',
    BIGINT = 'BIGINT',
    SMALLINT = 'SMALLINT',
    FLOAT = 'FLOAT',
    FLOAT4 = 'FLOAT4',
    FLOAT8 = 'FLOAT8',
    DOUBLE = 'DOUBLE',
    DOUBLE_PRECISION = 'DOUBLE PRECISION',
    REAL = 'REAL',
    FIXED = 'FIXED',
    STRING = 'STRING',
    TEXT = 'TEXT',
    BOOLEAN = 'BOOLEAN',
    DATE = 'DATE',
    DATETIME = 'DATETIME',
    TIME = 'TIME',
    TIMESTAMP = 'TIMESTAMP',
    TIMESTAMP_LTZ = 'TIMESTAMP_LTZ',
    TIMESTAMP_NTZ = 'TIMESTAMP_NTZ',
    TIMESTAMP_TZ = 'TIMESTAMP_TZ',
    VARIANT = 'VARIANT',
    OBJECT = 'OBJECT',
    ARRAY = 'ARRAY',
    GEOGRAPHY = 'GEOGRAPHY',
}

const normaliseSnowflakeType = (type: string): string => {
    const r = /^[A-Z]+/;
    const match = r.exec(type);
    if (match === null) {
        throw new ParseError(
            `Cannot understand type from Snowflake: ${type}`,
            {},
        );
    }
    return match[0];
};

export const mapFieldType = (type: string): DimensionType => {
    switch (normaliseSnowflakeType(type)) {
        case DuckdbTypes.NUMBER:
        case DuckdbTypes.DECIMAL:
        case DuckdbTypes.NUMERIC:
        case DuckdbTypes.INTEGER:
        case DuckdbTypes.INT:
        case DuckdbTypes.BIGINT:
        case DuckdbTypes.SMALLINT:
        case DuckdbTypes.FLOAT:
        case DuckdbTypes.FLOAT4:
        case DuckdbTypes.FLOAT8:
        case DuckdbTypes.DOUBLE:
        case DuckdbTypes.DOUBLE_PRECISION:
        case DuckdbTypes.REAL:
        case DuckdbTypes.FIXED:
            return DimensionType.NUMBER;
        case DuckdbTypes.DATE:
            return DimensionType.DATE;
        case DuckdbTypes.DATETIME:
        case DuckdbTypes.TIME:
        case DuckdbTypes.TIMESTAMP:
        case DuckdbTypes.TIMESTAMP_LTZ:
        case DuckdbTypes.TIMESTAMP_NTZ:
        case DuckdbTypes.TIMESTAMP_TZ:
            return DimensionType.TIMESTAMP;
        case DuckdbTypes.BOOLEAN:
            return DimensionType.BOOLEAN;
        default:
            return DimensionType.STRING;
    }
};

const parseCell = (cell: any) => {
    if (cell instanceof Date) {
        return new Date(cell);
    }

    return cell;
};

const parseRows = (rows: Record<string, any>[]) =>
    rows.map((row) =>
        Object.fromEntries(
            Object.entries(row).map(([name, value]) => [
                name,
                parseCell(value),
            ]),
        ),
    );

export class SnowflakeWarehouseClient implements WarehouseClient {
    connectionOptions: ConnectionOptions;

    startOfWeek: WeekDay | null | undefined;

    constructor(credentials: CreateSnowflakeCredentials) {
        this.startOfWeek = credentials.startOfWeek;
        let decodedPrivateKey: string | Buffer | undefined =
            credentials.privateKey;
        if (credentials.privateKey && credentials.privateKeyPass) {
            // Get the private key from the file as an object.
            const privateKeyObject = crypto.createPrivateKey({
                key: credentials.privateKey,
                format: 'pem',
                passphrase: credentials.privateKeyPass,
            });

            // Extract the private key from the object as a PEM-encoded string.
            decodedPrivateKey = privateKeyObject.export({
                format: 'pem',
                type: 'pkcs8',
            });
        }

        this.connectionOptions = {
            account: credentials.account,
            username: credentials.user,
            password: credentials.password,
            authenticator: decodedPrivateKey ? 'SNOWFLAKE_JWT' : undefined,
            privateKey: decodedPrivateKey,
            database: credentials.database,
            schema: credentials.schema,
            warehouse: credentials.warehouse,
            role: credentials.role,
            clientSessionKeepAlive: credentials.clientSessionKeepAlive,
            ...(credentials.accessUrl?.length
                ? { accessUrl: credentials.accessUrl }
                : {}),
        } as ConnectionOptions; // force type because accessUrl property is not recognised
    }

    getStartOfWeek() {
        return this.startOfWeek;
    }

    async runQuery(sqlText: string) {
        let connection: Connection;
        try {
            connection = createConnection(this.connectionOptions);
            await Util.promisify(connection.connect)();
        } catch (e) {
            throw new WarehouseConnectionError(`Snowflake error: ${e.message}`);
        }
        try {
            if (isWeekDay(this.startOfWeek)) {
                const snowflakeStartOfWeekIndex = this.startOfWeek + 1; // 1 (Monday) to 7 (Sunday):
                await this.executeStatement(
                    connection,
                    `ALTER SESSION SET WEEK_START = ${snowflakeStartOfWeekIndex};`,
                );
            }
            await this.executeStatement(
                connection,
                "ALTER SESSION SET TIMEZONE = 'UTC'",
            );
            const result = await this.executeStatement(connection, sqlText);
            return result;
        } catch (e) {
            throw new WarehouseQueryError(e.message);
        } finally {
            // todo: does this need to be promisified? uncaught error in callback?
            connection.destroy((err) => {
                if (err) {
                    throw new WarehouseConnectionError(err.message);
                }
            });
        }
    }

    // eslint-disable-next-line class-methods-use-this
    private async executeStatement(connection: Connection, sqlText: string) {
        return new Promise<{
            fields: Record<string, { type: DimensionType }>;
            rows: any[];
        }>((resolve, reject) => {
            connection.execute({
                sqlText,
                complete: (err, stmt, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (data) {
                        const fields = stmt.getColumns().reduce(
                            (acc, column) => ({
                                ...acc,
                                [column.getName()]: {
                                    type: mapFieldType(
                                        column.getType().toUpperCase(),
                                    ),
                                },
                            }),
                            {},
                        );
                        resolve({ fields, rows: parseRows(data) });
                    } else {
                        reject(
                            new WarehouseQueryError(
                                'Query result is undefined',
                            ),
                        );
                    }
                },
            });
        });
    }

    async test(): Promise<void> {
        await this.runQuery('SELECT 1');
    }

    async getCatalog(
        config: {
            database: string;
            schema: string;
            table: string;
        }[],
    ) {
        const sqlText = 'SHOW COLUMNS IN ACCOUNT';
        const { rows } = await this.runQuery(sqlText);
        return rows.reduce<WarehouseCatalog>((acc, row) => {
            const match = config.find(
                ({ database, schema, table }) =>
                    database.toLowerCase() ===
                        row.database_name.toLowerCase() &&
                    schema.toLowerCase() === row.schema_name.toLowerCase() &&
                    table.toLowerCase() === row.table_name.toLowerCase(),
            );
            // Unquoted identifiers will always be
            if (row.kind === 'COLUMN' && !!match) {
                acc[match.database] = acc[match.database] || {};
                acc[match.database][match.schema] =
                    acc[match.database][match.schema] || {};
                acc[match.database][match.schema][match.table] =
                    acc[match.database][match.schema][match.table] || {};
                acc[match.database][match.schema][match.table][
                    row.column_name
                ] = mapFieldType(JSON.parse(row.data_type).type);
            }
            return acc;
        }, {});
    }
}
