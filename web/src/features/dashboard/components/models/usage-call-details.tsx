/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import type { PaginationState } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { getAllLogs, getUserLogs } from '@/features/usage-logs/api'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import { useIsAdmin } from '@/hooks/use-admin'

import { buildUsageLogParams } from '../../lib/usage-log-query'
import type { DashboardFilters } from '../../types'
import { buildUsageCallColumns } from './usage-call-columns'

interface UsageCallDetailsProps {
  filters: DashboardFilters
}

function useUsageCallColumns(isAdmin: boolean) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage || i18n.language

  return useMemo(
    () => buildUsageCallColumns(isAdmin, t, locale),
    [isAdmin, locale, t]
  )
}

export function UsageCallDetails({ filters }: UsageCallDetailsProps) {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const columns = useUsageCallColumns(isAdmin)
  const queryParams = buildUsageLogParams(filters, pagination, isAdmin)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    )
  }, [
    filters.end_timestamp,
    filters.start_timestamp,
    filters.username,
    filters.time_granularity,
  ])

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['dashboard-usage-logs', isAdmin, queryParams],
    queryFn: async () => {
      const response = isAdmin
        ? await getAllLogs(queryParams)
        : await getUserLogs(queryParams)
      if (!response.success) {
        throw new Error(response.message || 'Failed to load logs')
      }
      return {
        items: (response.data?.items || []) as UsageLog[],
        total: response.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const { table } = useDataTable({
    data: data?.items || [],
    columns,
    pagination,
    onPaginationChange: setPagination,
    enableRowSelection: false,
    enableSorting: false,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    totalCount: data?.total || 0,
  })

  return (
    <section className='space-y-3 rounded-lg border p-4'>
      <div>
        <h2 className='text-base font-semibold'>{t('Usage Logs')}</h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          {t(
            'Usage records contain only the total API call count and total token count for the selected period.'
          )}
        </p>
      </div>
      <DataTablePage
        table={table}
        columns={columns}
        isLoading={isLoading}
        isFetching={isFetching}
        emptyTitle={t('No Logs Found')}
        emptyDescription={
          isError
            ? t('Failed to load logs')
            : t(
                'No usage logs available. Logs will appear here once API calls are made.'
              )
        }
        toolbarProps={null}
        fixedHeight={false}
        paginationInFooter={false}
        applyHeaderSize
        tableClassName='[&_[data-slot=table]]:text-xs'
      />
    </section>
  )
}
