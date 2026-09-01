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
import { describe, expect, test } from 'vitest'

import { HeroTerminalDemo } from '../hero-terminal-demo'

describe('home API demo', () => {
  test('shows the deployed DeepSeek model and verified protocols only', () => {
    render(<HeroTerminalDemo />)

    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Responses' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Claude' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Gemini' })
    ).not.toBeInTheDocument()
    expect(screen.getAllByText(/deepseek-v4-flash/).length).toBeGreaterThan(0)
  })
})
