import {
    CreateDuckdbCredentials,
    ParseError,
    WarehouseTypes,
} from '@lightdash/common';
import { JSONSchemaType } from 'ajv';
import betterAjvErrors from 'better-ajv-errors';
import { ajv } from '../../ajv';
import { Target } from '../types';

export type DuckdbTarget = {
    type: 'Duckdb';
    host: string;
    user: string;
    password: string;
    port: number;
    database: string;
    schema: string;
    http_scheme: string;
};

export const DuckdbSchema: JSONSchemaType<DuckdbTarget> = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: ['Duckdb'],
        },
        schema: {
            type: 'string',
        },
        host: {
            type: 'string',
        },
        user: {
            type: 'string',
        },
        password: {
            type: 'string',
        },
        port: {
            type: 'number',
        },
        database: {
            type: 'string',
        },
        http_scheme: {
            type: 'string',
        },
    },
    required: [
        'type',
        'schema',
        'host',
        'user',
        'password',
        'port',
        'database',
        'http_scheme',
    ],
};

export const convertDuckdbSchema = (target: Target): CreateDuckdbCredentials => {
    const validate = ajv.compile<DuckdbTarget>(DuckdbSchema);

    if (validate(target)) {
        return {
            type: WarehouseTypes.DUCKDB,
            schema: target.schema,
            host: target.host,
            user: target.user,
            password: target.password,
            port: target.port,
            dbname: target.database,
            http_scheme: target.http_scheme,
        };
    }

    const errs = betterAjvErrors(DuckdbSchema, target, validate.errors || []);
    throw new ParseError(
        `Couldn't read profiles.yml file for ${target.type}:\n${errs}`,
    );
};