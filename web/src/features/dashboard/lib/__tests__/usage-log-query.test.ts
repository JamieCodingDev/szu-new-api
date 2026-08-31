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

import { LOG_TYPE_ENUM } from '@/features/usage-logs/constants'

import { buildUsageLogParams } from '../usage-log-query'

describe('dashboard usage log query', () => {
  const filters = {
    start_timestamp: new Date('2026-08-01T00:00:00.000Z'),
    end_timestamp: new Date('2026-08-31T23:59:59.000Z'),
    username: 'student-a',
  }

  it('requests only consumption records and applies admin user filtering', () => {
    const result = buildUsageLogParams(
      filters,
      { pageIndex: 2, pageSize: 20 },
      true
    )

    expect(result).toEqual({
      p: 3,
      page_size: 20,
      type: LOG_TYPE_ENUM.CONSUME,
      start_timestamp: 1_785_542_400,
      end_timestamp: 1_788_220_799,
      username: 'student-a',
    })
  })

  it('never sends an admin username filter for a regular user', () => {
    const result = buildUsageLogParams(
      filters,
      { pageIndex: 0, pageSize: 10 },
      false
    )

    expect(result.username).toBeUndefined()
  })
})
