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
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@/components/layout', () => ({
  formatSiteBrandName: (laboratoryName: string) =>
    `${laboratoryName} · New API`,
  PublicLayout: ({
    children,
    siteName,
  }: {
    children: ReactNode
    siteName?: string
  }) => <main data-site-name={siteName}>{children}</main>,
}))

vi.mock('@/components/rich-content', () => ({
  RichContent: () => <div data-testid='rich-content' />,
}))

vi.mock('@/context/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ auth: { user: null } }),
}))

vi.mock('../hooks', () => ({
  useHomePageContent: () => ({ content: '', isLoaded: true, isUrl: false }),
}))

vi.mock('../components', () => ({
  Hero: () => <section data-testid='hero' />,
  Stats: () => <section data-testid='stats' />,
  Features: () => <section data-testid='features' />,
  HowItWorks: () => <section data-testid='how-it-works' />,
  CTA: () => <section data-testid='cta' />,
}))

const { Home } = await import('../index')

describe('default home page', () => {
  test('renders only the hero content', () => {
    render(<Home />)

    expect(screen.getByTestId('hero')).toBeInTheDocument()
    expect(screen.queryByTestId('stats')).not.toBeInTheDocument()
    expect(screen.queryByTestId('features')).not.toBeInTheDocument()
    expect(screen.queryByTestId('how-it-works')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cta')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute(
      'data-site-name',
      'SNRC Intelligent Interconnection Network Laboratory · New API'
    )
  })
})
