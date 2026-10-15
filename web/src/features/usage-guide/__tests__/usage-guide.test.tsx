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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  getUsageGuideCards: vi.fn(),
  updateUsageGuideCard: vi.fn(),
}))

const adminState = vi.hoisted(() => ({ value: false }))

vi.mock('../api', () => ({
  ...apiMocks,
  USAGE_GUIDE_QUERY_KEY: ['usage-guide'],
}))

vi.mock('@/hooks/use-admin', () => ({
  useIsAdmin: () => adminState.value,
}))

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

function renderUsageGuide() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <UsageGuide />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

describe('usage guide', () => {
  beforeEach(() => {
    adminState.value = false
    apiMocks.getUsageGuideCards.mockReset()
    apiMocks.updateUsageGuideCard.mockReset()
    apiMocks.getUsageGuideCards.mockResolvedValue({ success: true, data: {} })
    apiMocks.updateUsageGuideCard.mockImplementation(
      (cardId: string, content: string) =>
        Promise.resolve({
          success: true,
          data: { [cardId]: content },
        })
    )
  })

  test('shows concise setup cards for every supported client', () => {
    const { container } = renderUsageGuide()

    expect(
      screen.getByRole('heading', { name: '使用手册' })
    ).toBeInTheDocument()
    expect(screen.getAllByText('OpenCode').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Codex').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Claude Code').length).toBeGreaterThan(0)
    expect(screen.getAllByText('DeepSeek Harness').length).toBeGreaterThan(0)

    const content = container.textContent ?? ''
    expect(content).toContain('https://llm.snrc.site/v1')
    expect(content).toContain('deepseek-v4-flash')
    expect(content).toContain('wire_api = "responses"')
    expect(content).toContain('OpenAI Chat Completions (Requires Routing)')
    expect(content).toContain('npx @deepseek-ai/dsh web')
    expect(content).not.toContain("item['content'] is not an array")
    expect(content).not.toContain('Invoke-RestMethod')
  })

  test('propagates a stored Base URL through every client configuration', async () => {
    const connection = {
      title: '连接信息',
      description: '统一连接参数',
      serviceUrl: 'https://gateway.example',
      baseUrl: 'https://gateway.example/openai/v1',
      modelId: 'custom-model',
      notice: '请妥善保存密钥。',
    }
    apiMocks.getUsageGuideCards.mockResolvedValue({
      success: true,
      data: { 'before-start': JSON.stringify(connection) },
    })

    const { container } = renderUsageGuide()

    await waitFor(() => {
      expect(container.textContent).toContain(
        'https://gateway.example/openai/v1/chat/completions'
      )
    })
    expect(container.textContent).toContain(
      'base_url = "https://gateway.example/openai/v1"'
    )
    expect(container.textContent).toContain('szu/custom-model')
    expect(container.textContent).not.toContain('https://llm.snrc.site/v1')
  })

  test('lets an administrator edit the connection card independently', async () => {
    adminState.value = true
    const user = userEvent.setup()
    const { container } = renderUsageGuide()

    await user.click(screen.getByRole('button', { name: 'Edit 开始前准备' }))
    const dialog = screen.getByRole('dialog')
    const baseUrl = within(dialog).getByRole('textbox', {
      name: 'OpenAI-compatible Base URL',
    })
    await user.clear(baseUrl)
    await user.type(baseUrl, 'https://new.example/v1')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(apiMocks.updateUsageGuideCard).toHaveBeenCalledTimes(1)
    })
    const [cardId, raw] = apiMocks.updateUsageGuideCard.mock.calls[0]
    expect(cardId).toBe('before-start')
    expect(JSON.parse(raw).baseUrl).toBe('https://new.example/v1')
    await waitFor(() => {
      expect(container.textContent).toContain(
        'https://new.example/v1/chat/completions'
      )
    })
  })

  test('saves one client card without replacing the other cards', async () => {
    adminState.value = true
    const user = userEvent.setup()
    renderUsageGuide()

    await user.click(screen.getByRole('button', { name: 'Edit OpenCode' }))
    const dialog = screen.getByRole('dialog')
    const title = within(dialog).getAllByRole('textbox', { name: 'Title' })[0]
    await user.clear(title)
    await user.type(title, 'OpenCode 校内版')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(apiMocks.updateUsageGuideCard).toHaveBeenCalledTimes(1)
    })
    const [cardId, raw] = apiMocks.updateUsageGuideCard.mock.calls[0]
    expect(cardId).toBe('opencode')
    expect(JSON.parse(raw).title).toBe('OpenCode 校内版')
    expect(screen.getAllByText('Codex').length).toBeGreaterThan(0)
  })
})
