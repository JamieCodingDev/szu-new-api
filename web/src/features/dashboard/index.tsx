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
import { lazy, Suspense, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'

import { ModelsFilter } from './components/models/models-filter-dialog'
import { buildDefaultDashboardFilters, getSavedChartPreferences } from './lib'
import type { DashboardFilters, QuotaDataItem } from './types'

const LazyLogStatCards = lazy(() =>
  import('./components/models/log-stat-cards').then((module) => ({
    default: module.LogStatCards,
  }))
)

const LazyUsageTrendCharts = lazy(() =>
  import('./components/models/usage-trend-charts').then((module) => ({
    default: module.UsageTrendCharts,
  }))
)

const LazyUsageCallDetails = lazy(() =>
  import('./components/models/usage-call-details').then((module) => ({
    default: module.UsageCallDetails,
  }))
)

function UsageCardsFallback() {
  return (
    <div className='grid grid-cols-2 overflow-hidden rounded-lg border'>
      <div className='space-y-2 border-r px-5 py-4'>
        <Skeleton className='h-4 w-28' />
        <Skeleton className='h-7 w-20' />
      </div>
      <div className='space-y-2 px-5 py-4'>
        <Skeleton className='h-4 w-28' />
        <Skeleton className='h-7 w-20' />
      </div>
    </div>
  )
}

function UsageChartsFallback() {
  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      {[0, 1].map((item) => (
        <div key={item} className='space-y-4 rounded-lg border p-4'>
          <Skeleton className='h-5 w-36' />
          <Skeleton className='h-[260px] w-full' />
        </div>
      ))}
    </div>
  )
}

export function Dashboard() {
  const { t } = useTranslation()
  const preferences = getSavedChartPreferences()
  const [filters, setFilters] = useState<DashboardFilters>(() =>
    buildDefaultDashboardFilters(preferences)
  )
  const [usageData, setUsageData] = useState<QuotaDataItem[]>([])
  const [usageLoading, setUsageLoading] = useState(true)

  const handleReset = useCallback(() => {
    setFilters(buildDefaultDashboardFilters(preferences))
  }, [preferences])

  const handleUsageDataUpdate = useCallback(
    (data: QuotaDataItem[], loading: boolean) => {
      setUsageData(data)
      setUsageLoading(loading)
    },
    []
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Usage Information')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <ModelsFilter
          preferences={preferences}
          currentFilters={filters}
          onFilterChange={setFilters}
          onReset={handleReset}
        />
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Usage records contain only the total API call count and total token count for the selected period.'
            )}
          </p>
          <FadeIn>
            <Suspense fallback={<UsageCardsFallback />}>
              <LazyLogStatCards
                filters={filters}
                onDataUpdate={handleUsageDataUpdate}
              />
            </Suspense>
          </FadeIn>
          <FadeIn delay={0.05}>
            <Suspense fallback={<UsageChartsFallback />}>
              <LazyUsageTrendCharts
                data={usageData}
                loading={usageLoading}
                timeGranularity={filters.time_granularity}
              />
            </Suspense>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Suspense fallback={<Skeleton className='h-80 w-full' />}>
              <LazyUsageCallDetails filters={filters} />
            </Suspense>
          </FadeIn>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
