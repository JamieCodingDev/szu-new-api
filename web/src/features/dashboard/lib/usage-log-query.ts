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
import type { PaginationState } from '@tanstack/react-table'

import type { DashboardFilters } from '@/features/dashboard/types'
import { LOG_TYPE_ENUM } from '@/features/usage-logs/constants'
import type { GetLogsParams } from '@/features/usage-logs/types'

export function buildUsageLogParams(
  filters: DashboardFilters,
  pagination: PaginationState,
  isAdmin: boolean
): GetLogsParams {
  return {
    p: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
    type: LOG_TYPE_ENUM.CONSUME,
    start_timestamp: filters.start_timestamp
      ? Math.floor(filters.start_timestamp.getTime() / 1000)
      : undefined,
    end_timestamp: filters.end_timestamp
      ? Math.floor(filters.end_timestamp.getTime() / 1000)
      : undefined,
    username: isAdmin ? filters.username || undefined : undefined,
  }
}
