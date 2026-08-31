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
import { VChart } from '@visactor/react-vchart'
import { ChartSpline, Layers } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { processChartData } from '@/features/dashboard/lib'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { useThemeRadiusPx } from '@/lib/theme-radius'
import type { TimeGranularity } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

interface UsageTrendChartsProps {
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: TimeGranularity
}

export function UsageTrendCharts({
  data,
  loading = false,
  timeGranularity = 'day',
}: UsageTrendChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const chartRadius = useThemeRadiusPx(
    '--radius-md',
    `${customization.preset}:${customization.radius}`
  )
  const [themeReady, setThemeReady] = useState(false)

  useEffect(() => {
    let active = true

    const updateTheme = async () => {
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (module) => module.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      if (!active) return
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }

    setThemeReady(false)
    void updateTheme()
    return () => {
      active = false
    }
  }, [resolvedTheme])

  const chartData = useMemo(
    () =>
      processChartData(loading ? [] : data, timeGranularity, t, chartRadius),
    [chartRadius, data, loading, t, timeGranularity]
  )

  const charts = [
    {
      id: 'requests',
      title: t('Request Count'),
      total: chartData.totalCountDisplay,
      icon: ChartSpline,
      tone: 'chart-1' as const,
      spec: chartData.spec_model_line,
    },
    {
      id: 'tokens',
      title: t('Total Tokens'),
      total: chartData.totalTokensDisplay,
      icon: Layers,
      tone: 'chart-4' as const,
      spec: chartData.spec_token_bar,
    },
  ]

  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      {charts.map((chart) => {
        const Icon = chart.icon
        const chartKey = [
          chart.id,
          loading ? 'loading' : 'ready',
          data.length,
          resolvedTheme,
          customization.preset,
        ].join('-')

        return (
          <section key={chart.id} className='overflow-hidden rounded-lg border'>
            <div className='flex items-center gap-2 border-b px-4 py-3'>
              <IconBadge tone={chart.tone} size='sm'>
                <Icon />
              </IconBadge>
              <h2 className='text-sm font-semibold'>{chart.title}</h2>
              <span className='text-muted-foreground text-sm tabular-nums'>
                {chart.total}
              </span>
            </div>
            <div className='h-[300px] p-2'>
              {themeReady && (
                <VChart
                  key={chartKey}
                  spec={{
                    ...chart.spec,
                    title: { visible: false },
                    theme: resolvedTheme === 'dark' ? 'dark' : 'light',
                    background: 'transparent',
                  }}
                  option={VCHART_OPTION}
                />
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
