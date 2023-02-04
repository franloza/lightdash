import {
    ChartType,
    CreateSavedChartVersion,
    Field,
    fieldId as getFieldId,
    FilterOperator,
    FilterRule,
    getDimensions,
    getFields,
    getResultValues,
    isDimension,
    isField,
    isMetric,
    Metric,
    MetricQuery,
} from '@lightdash/common';
import { FC, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useExplore } from '../../hooks/useExplore';
import { getExplorerUrlFromCreateSavedChartVersion } from '../../hooks/useExplorerRoute';
import { useUnderlyingDataResults } from '../../hooks/useQueryResults';
import ErrorState from '../common/ErrorState';
import LinkButton from '../common/LinkButton';
import { TableColumn } from '../common/Table/types';
import DownloadCsvButton from '../DownloadCsvButton';
import { useMetricQueryDataContext } from './MetricQueryDataProvider';
import { HeaderRightContent } from './UnderlyingDataModal.styles';
import UnderlyingDataResultsTable from './UnderlyingDataResultsTable';

interface Props {}

const defaultMetricQuery: MetricQuery = {
    dimensions: [],
    metrics: [],
    filters: {},
    sorts: [],
    limit: 500,
    tableCalculations: [],
    additionalMetrics: [],
};

const UnderlyingDataModalContent: FC<Props> = () => {
    const { projectUuid } = useParams<{ projectUuid: string }>();
    const { tableName, metricQuery, underlyingDataConfig } =
        useMetricQueryDataContext();

    const { data: explore } = useExplore(tableName, { refetchOnMount: false });

    const allFields = useMemo(
        () => (explore ? getFields(explore) : []),
        [explore],
    );
    const allDimensions = useMemo(
        () => (explore ? getDimensions(explore) : []),
        [explore],
    );

    const joinedTables = useMemo(
        () =>
            (explore?.joinedTables || []).map(
                (joinedTable) => joinedTable.table,
            ),
        [explore],
    );

    const showUnderlyingValues: string[] | undefined = useMemo(() => {
        return underlyingDataConfig?.meta !== undefined &&
            isField(underlyingDataConfig?.meta?.item) &&
            isMetric(underlyingDataConfig?.meta.item)
            ? underlyingDataConfig?.meta.item.showUnderlyingValues
            : undefined;
    }, [underlyingDataConfig?.meta]);

    const sortByUnderlyingValues = useCallback(
        (columnA: TableColumn, columnB: TableColumn) => {
            if (showUnderlyingValues === undefined) return 0;

            const indexOfUnderlyingValue = (column: TableColumn): number => {
                const columnDimension = allDimensions.find(
                    (dimension) => getFieldId(dimension) === column.id,
                );
                if (columnDimension === undefined) return -1;
                return showUnderlyingValues?.indexOf(columnDimension.name) !==
                    -1
                    ? showUnderlyingValues?.indexOf(columnDimension.name)
                    : showUnderlyingValues?.indexOf(
                          `${columnDimension.table}.${columnDimension.name}`,
                      );
            };

            return (
                indexOfUnderlyingValue(columnA) -
                indexOfUnderlyingValue(columnB)
            );
        },
        [showUnderlyingValues, allDimensions],
    );

    const underlyingDataMetricQuery = useMemo<MetricQuery>(() => {
        if (!underlyingDataConfig) return defaultMetricQuery;
        const { meta, row, pivotReference, dimensions, value } =
            underlyingDataConfig;
        if (meta?.item === undefined) return defaultMetricQuery;

        // We include tables from all fields that appear on the SQL query (aka tables from all columns in results)
        const rowFieldIds = pivotReference?.pivotValues
            ? [
                  ...pivotReference.pivotValues.map(({ field }) => field),
                  ...Object.keys(row),
              ]
            : Object.keys(row);

        // On charts, we might want to include the dimensions from SQLquery and not from rowdata, so we include those instead
        const dimensionFieldIds = dimensions ? dimensions : rowFieldIds;
        const fieldsInQuery = allFields.filter((field) =>
            dimensionFieldIds.includes(getFieldId(field)),
        );
        const availableTables = new Set([
            ...joinedTables,
            ...fieldsInQuery.map((field) => field.table),
            tableName,
        ]);

        // If we are viewing data from a metric or a table calculation, we filter using all existing dimensions in the table
        const dimensionFilters = !isDimension(meta?.item)
            ? Object.entries(row).reduce((acc, r) => {
                  const [
                      key,
                      {
                          value: { raw },
                      },
                  ] = r;

                  const dimensionFilter: FilterRule = {
                      id: uuidv4(),
                      target: {
                          fieldId: key,
                      },
                      operator:
                          raw === null
                              ? FilterOperator.NULL
                              : FilterOperator.EQUALS,
                      values: raw === null ? undefined : [raw],
                  };
                  const isValidDimension = allDimensions.find(
                      (dimension) => getFieldId(dimension) === key,
                  );

                  if (isValidDimension) {
                      return [...acc, dimensionFilter];
                  }
                  return acc;
              }, [] as FilterRule[])
            : [
                  {
                      id: uuidv4(),
                      target: {
                          fieldId: getFieldId(meta?.item),
                      },
                      operator:
                          value.raw === null
                              ? FilterOperator.NULL
                              : FilterOperator.EQUALS,
                      values: value.raw === null ? undefined : [value.raw],
                  },
              ];

        const pivotFilter: FilterRule[] = (
            pivotReference?.pivotValues || []
        ).map((pivot) => ({
            id: uuidv4(),
            target: {
                fieldId: pivot.field,
            },
            operator: FilterOperator.EQUALS,
            values: [pivot.value],
        }));

        // Metric filters fieldId don't have table prefixes, we add it here
        const metric: Metric | undefined =
            isField(meta?.item) && isMetric(meta.item) ? meta.item : undefined;
        const metricFilters =
            metric?.filters?.map((filter) => {
                return {
                    ...filter,
                    target: {
                        fieldId: getFieldId({
                            ...metric,
                            name: filter.target.fieldId,
                        }),
                    },
                };
            }) || [];
        const exploreFilters =
            metricQuery?.filters?.dimensions !== undefined
                ? [metricQuery.filters.dimensions]
                : [];

        const dashboardFilters = underlyingDataConfig.dashboardFilters
            ? underlyingDataConfig.dashboardFilters.dimensions
            : [];
        const combinedFilters = [
            ...exploreFilters,
            ...dimensionFilters,
            ...pivotFilter,
            ...metricFilters,
            ...dashboardFilters,
        ];

        const allFilters = {
            dimensions: {
                id: uuidv4(),
                and: combinedFilters,
            },
        };
        const showUnderlyingTable: string | undefined = isField(meta?.item)
            ? meta.item.table
            : undefined;
        const availableDimensions = allDimensions.filter(
            (dimension) =>
                availableTables.has(dimension.table) &&
                !dimension.timeInterval &&
                !dimension.hidden &&
                (showUnderlyingValues !== undefined
                    ? (showUnderlyingValues.includes(dimension.name) &&
                          showUnderlyingTable === dimension.table) ||
                      showUnderlyingValues.includes(
                          `${dimension.table}.${dimension.name}`,
                      )
                    : true),
        );
        const dimensionFields = availableDimensions.map(getFieldId);
        return {
            ...defaultMetricQuery,
            dimensions: dimensionFields,
            filters: allFilters,
        };
    }, [
        underlyingDataConfig,
        metricQuery,
        tableName,
        allFields,
        allDimensions,
        joinedTables,
        showUnderlyingValues,
    ]);

    const fieldsMap: Record<string, Field> = useMemo(() => {
        const selectedDimensions = underlyingDataMetricQuery.dimensions;
        const dimensions = explore ? getDimensions(explore) : [];
        return dimensions.reduce((acc, dimension) => {
            const fieldId = isField(dimension) ? getFieldId(dimension) : '';
            if (selectedDimensions.includes(fieldId))
                return {
                    ...acc,
                    [fieldId]: dimension,
                };
            else return acc;
        }, {});
    }, [explore, underlyingDataMetricQuery]);

    const exploreFromHereUrl = useMemo(() => {
        const showDimensions =
            showUnderlyingValues !== undefined
                ? underlyingDataMetricQuery.dimensions
                : [];

        const createSavedChartVersion: CreateSavedChartVersion = {
            tableName,
            metricQuery: {
                ...underlyingDataMetricQuery,
                dimensions: showDimensions,
                metrics: [],
            },
            pivotConfig: undefined,
            tableConfig: {
                columnOrder: [],
            },
            chartConfig: {
                type: ChartType.CARTESIAN,
                config: { layout: {}, eChartsConfig: {} },
            },
        };
        const { pathname, search } = getExplorerUrlFromCreateSavedChartVersion(
            projectUuid,
            createSavedChartVersion,
        );
        return `${pathname}?${search}`;
    }, [
        tableName,
        underlyingDataMetricQuery,
        projectUuid,
        showUnderlyingValues,
    ]);

    const {
        error,
        data: resultsData,
        isLoading,
    } = useUnderlyingDataResults(tableName, underlyingDataMetricQuery);

    if (error) {
        return <ErrorState error={error.error} hasMarginTop={false} />;
    }

    return (
        <>
            <HeaderRightContent>
                <DownloadCsvButton
                    fileName={tableName}
                    rows={resultsData && getResultValues(resultsData.rows)}
                />
                <LinkButton
                    intent="primary"
                    href={exploreFromHereUrl}
                    icon="series-search"
                    forceRefresh
                >
                    Explore from here
                </LinkButton>
            </HeaderRightContent>
            <UnderlyingDataResultsTable
                isLoading={isLoading}
                resultsData={resultsData}
                fieldsMap={fieldsMap}
                hasJoins={joinedTables.length > 0}
                sortByUnderlyingValues={sortByUnderlyingValues}
            />
        </>
    );
};

export default UnderlyingDataModalContent;
