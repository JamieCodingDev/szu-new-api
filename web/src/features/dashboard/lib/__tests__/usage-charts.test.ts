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
import { describe, expect, it } from 'vitest'

import type { QuotaDataItem } from '../../types'
import { processChartData } from '../charts'

describe('usage trend charts', () => {
  it('aggregates request and token totals by model and time', () => {
    const timestamp = 1_788_102_000
    const rows: QuotaDataItem[] = [
      {
        created_at: timestamp,
        model_name: 'deepseek-v4-flash',
        count: 2,
        token_used: 100,
      },
      {
        created_at: timestamp,
        model_name: 'deepseek-v4-flash',
        count: 3,
        token_used: 50,
      },
      {
        created_at: timestamp,
        model_name: 'other-model',
        count: 1,
        token_used: 25,
      },
    ]

    const result = processChartData(rows, 'day')
    const requestValues = result.spec_model_line.data[0].values as Array<{
      Model: string
      Count: number
    }>
    const tokenValues = result.spec_token_bar.data[0].values as Array<{
      Model: string
      Tokens: number
    }>

    expect(
      requestValues.find(
        (value) => value.Model === 'deepseek-v4-flash' && value.Count === 5
      )
    ).toBeTruthy()
    expect(
      tokenValues.find(
        (value) => value.Model === 'deepseek-v4-flash' && value.Tokens === 150
      )
    ).toBeTruthy()
    expect(result.totalCountDisplay).toBe('6')
    expect(result.totalTokensDisplay).toBe('175')
  })

  it('returns empty request and token series without usage data', () => {
    const result = processChartData([])

    expect(result.spec_model_line.data[0].values).toEqual([])
    expect(result.spec_token_bar.data[0].values).toEqual([])
    expect(result.totalCountDisplay).toBe('0')
    expect(result.totalTokensDisplay).toBe('0')
  })
})
