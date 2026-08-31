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
  PublicLayout: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}))

vi.mock('@/components/copy-button', () => ({
  CopyButton: ({ value }: { value: string }) => (
    <button type='button' aria-label={`copy-${value}`} />
  ),
}))

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { UsageGuide } = await import('../index')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'zhCN',
  fallbackLng: 'en',
  resources: {
    zhCN: {
      translation: {
        'Usage Guide': '使用手册',
        'Client Setup Guide': '客户端部署与配置',
      },
    },
  },
})

describe('usage guide', () => {
  test('documents all supported clients and their required protocols', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <UsageGuide />
      </I18nextProvider>
    )

    expect(
      screen.getByRole('heading', { name: '使用手册' })
    ).toBeInTheDocument()
    expect(screen.getAllByText('OpenCode').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Codex').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Claude Code').length).toBeGreaterThan(0)
    expect(screen.getAllByText('DeepSeek Harness').length).toBeGreaterThan(0)

    const content = container.textContent ?? ''
    expect(content).toContain('http://172.31.233.175:3000/v1')
    expect(content).toContain('deepseek-v4-flash')
    expect(content).toContain('model_context_window = 131072')
    expect(content).toContain('model_auto_compact_token_limit = 114688')
    expect(content).toContain('wire_api = "responses"')
    expect(content).toContain('requires_openai_auth = false')
    expect(content).toContain('Token 长度')
    expect(content).toContain('/v1/models')
    expect(content).toContain('/v1/responses')
    expect(content).toContain('Invoke-RestMethod')
    expect(content).toContain("item['content'] is not an array")
    expect(content).toContain('/v1/chat/completions')
    expect(content).toContain('http://127.0.0.1:15721')
    expect(content).toContain('npx @deepseek-ai/dsh web')
  })
})
