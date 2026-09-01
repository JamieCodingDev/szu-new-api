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
import { cloneElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'Get Started': '开始使用',
        'Usage Guide': '使用手册',
      })[key] ?? key,
  }),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    render: trigger,
  }: {
    children?: ReactNode
    render?: ReactElement
  }) =>
    trigger ? (
      cloneElement(trigger, {}, children)
    ) : (
      <button type='button'>{children}</button>
    ),
}))

vi.mock('../../hero-terminal-demo', () => ({
  HeroTerminalDemo: () => <div data-testid='terminal-demo' />,
}))

const { Hero } = await import('../hero')

describe('home hero actions', () => {
  test('links authenticated users to the dashboard and usage guide', () => {
    render(<Hero isAuthenticated />)

    expect(screen.getByRole('link', { name: '开始使用' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
    expect(screen.getByRole('link', { name: '使用手册' })).toHaveAttribute(
      'href',
      '/usage-guide'
    )
  })

  test('links unauthenticated users to sign in instead of registration', () => {
    render(<Hero isAuthenticated={false} />)

    expect(screen.getByRole('link', { name: '开始使用' })).toHaveAttribute(
      'href',
      '/sign-in'
    )
  })

  test('does not render the supported applications block', () => {
    render(<Hero isAuthenticated />)

    expect(screen.getByText('DeepSeek V4 Flash API')).toBeInTheDocument()
    expect(screen.getByText('Dedicated Inference Service')).toBeInTheDocument()
    expect(
      screen.queryByText('Vast Range of AI Models')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Supported Applications')).not.toBeInTheDocument()
    expect(screen.queryByText('Cherry Studio')).not.toBeInTheDocument()
    expect(screen.queryByText('CC Switch')).not.toBeInTheDocument()
  })
})
