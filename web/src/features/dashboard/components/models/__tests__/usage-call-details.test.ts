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
import type { ColumnDef } from '@tanstack/react-table'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { UsageLog } from '@/features/usage-logs/data/schema'

import { buildUsageCallColumns } from '../usage-call-columns'

function getColumnId(column: ColumnDef<UsageLog>): string {
  if (column.id) return column.id
  if ('accessorKey' in column) return String(column.accessorKey)
  return ''
}

describe('embedded usage log columns', () => {
  it('shows token usage details without any cost or pricing columns', () => {
    const columns = buildUsageCallColumns(true, (key) => key, 'en-US')
    const columnIds = columns.map(getColumnId)

    expect(columnIds).toEqual([
      'created_at',
      'username',
      'token_name',
      'model_name',
      'prompt_tokens',
      'completion_tokens',
      'total_tokens',
      'use_time',
    ])
    expect(columnIds).not.toContain('quota')
    expect(columnIds).not.toContain('content')
  })

  it('keeps other users hidden from a regular user view', () => {
    const columns = buildUsageCallColumns(false, (key) => key, 'en-US')

    expect(columns.map(getColumnId)).not.toContain('username')
  })

  it('formats numbers when i18next supplies the internal zhCN language code', () => {
    const columns = buildUsageCallColumns(false, (key) => key, 'zhCN')
    const totalTokensColumn = columns.find(
      (column) => getColumnId(column) === 'total_tokens'
    )

    expect(typeof totalTokensColumn?.cell).toBe('function')

    const cell = totalTokensColumn?.cell as (context: unknown) => ReactElement
    const markup = renderToStaticMarkup(
      cell({
        row: {
          original: {
            prompt_tokens: 1_000,
            completion_tokens: 234,
          },
        },
      })
    )

    expect(markup).toContain('1,234')
  })
})
