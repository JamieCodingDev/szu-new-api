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

import { LongText } from '@/components/long-text'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import {
  formatNumber,
  formatTimestampToDate,
  formatUseTime,
} from '@/lib/format'

type Translate = (key: string) => string

export function buildUsageCallColumns(
  isAdmin: boolean,
  t: Translate,
  locale: Intl.LocalesArgument
): ColumnDef<UsageLog>[] {
  const columns: ColumnDef<UsageLog>[] = [
    {
      accessorKey: 'created_at',
      header: t('Time'),
      cell: ({ row }) => (
        <span className='font-mono text-xs tabular-nums'>
          {formatTimestampToDate(row.original.created_at)}
        </span>
      ),
      size: 180,
      enableSorting: false,
      meta: { mobileOrder: 10 },
    },
  ]

  if (isAdmin) {
    columns.push({
      accessorKey: 'username',
      header: t('User'),
      cell: ({ row }) => (
        <LongText className='max-w-[160px] font-medium'>
          {row.original.username || '-'}
        </LongText>
      ),
      size: 170,
      enableSorting: false,
      meta: { mobileTitle: true },
    })
  }

  columns.push(
    {
      accessorKey: 'token_name',
      header: t('API Key'),
      cell: ({ row }) => (
        <LongText className='max-w-[140px]'>
          {row.original.token_name || '-'}
        </LongText>
      ),
      size: 150,
      enableSorting: false,
      meta: { mobileOrder: 20 },
    },
    {
      accessorKey: 'model_name',
      header: t('Model'),
      cell: ({ row }) => (
        <LongText className='max-w-[190px] font-mono text-xs'>
          {row.original.model_name || '-'}
        </LongText>
      ),
      size: 200,
      enableSorting: false,
      meta: { mobileBadge: true },
    },
    {
      accessorKey: 'prompt_tokens',
      header: t('Input Tokens'),
      cell: ({ row }) => (
        <span className='font-mono text-xs tabular-nums'>
          {formatNumber(row.original.prompt_tokens, locale)}
        </span>
      ),
      size: 130,
      enableSorting: false,
      meta: { mobileOrder: 30 },
    },
    {
      accessorKey: 'completion_tokens',
      header: t('Output Tokens'),
      cell: ({ row }) => (
        <span className='font-mono text-xs tabular-nums'>
          {formatNumber(row.original.completion_tokens, locale)}
        </span>
      ),
      size: 130,
      enableSorting: false,
      meta: { mobileOrder: 40 },
    },
    {
      id: 'total_tokens',
      header: t('Total Tokens'),
      accessorFn: (row) => row.prompt_tokens + row.completion_tokens,
      cell: ({ row }) => (
        <span className='font-mono text-xs font-semibold tabular-nums'>
          {formatNumber(
            row.original.prompt_tokens + row.original.completion_tokens,
            locale
          )}
        </span>
      ),
      size: 130,
      enableSorting: false,
      meta: { mobileOrder: 50 },
    },
    {
      accessorKey: 'use_time',
      header: t('Duration'),
      cell: ({ row }) => (
        <span className='text-muted-foreground text-xs tabular-nums'>
          {formatUseTime(row.original.use_time)}
        </span>
      ),
      size: 110,
      enableSorting: false,
      meta: { mobileOrder: 60 },
    }
  )

  return columns
}
