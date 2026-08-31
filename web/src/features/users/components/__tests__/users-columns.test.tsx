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
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useUsersColumns } from '../users-columns'

function QuotaColumnProbe() {
  const quotaColumn = useUsersColumns().find((column) => column.id === 'quota')
  return (
    <div data-testid='quota-column'>
      {typeof quotaColumn?.header === 'string' ? quotaColumn.header : ''}
    </div>
  )
}

describe('user quota column', () => {
  it('labels the user quota balance as current available quota', () => {
    render(<QuotaColumnProbe />)

    expect(screen.getByTestId('quota-column')).toHaveTextContent(
      'Current Available Quota'
    )
    expect(screen.getByTestId('quota-column')).not.toHaveTextContent(
      'Redemption Quota'
    )
  })
})
