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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { ApiKeysProvider } = await import('../api-keys-provider')
const { ApiKeysMutateDrawer } = await import('../api-keys-mutate-drawer')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

type ApiPost = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = { post: ApiPost }

const apiClient = api as unknown as MockableApi
const originalPost = apiClient.post
let queryClient: InstanceType<typeof QueryClient> | null = null

function renderCreateDrawer() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ApiKeysProvider>
          <ApiKeysMutateDrawer open onOpenChange={() => undefined} />
        </ApiKeysProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  apiClient.post = originalPost
  queryClient?.clear()
  queryClient = null
})

describe('credential-only API key drawer', () => {
  test('creates one unrestricted credential from its name', async () => {
    const createdPayloads: Array<Record<string, unknown>> = []
    apiClient.post = async (url, data) => {
      expect(url).toBe('/api/token/')
      createdPayloads.push(data as Record<string, unknown>)
      return { data: { success: true } }
    }
    renderCreateDrawer()

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'coursework' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(createdPayloads).toHaveLength(1))
    expect(createdPayloads[0]).toEqual({
      name: 'coursework',
      expired_time: -1,
      remain_quota: 0,
      unlimited_quota: true,
      model_limits_enabled: false,
      model_limits: '',
      allow_ips: '',
      group: 'default',
      cross_group_retry: false,
      auto_groups: [],
    })
  })

  test('does not render quota, group, expiry, model, or IP controls', () => {
    renderCreateDrawer()

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    for (const removedLabel of [
      'Quota',
      'Group',
      'Expiration time',
      'Model limits',
      'IP restrictions',
    ]) {
      expect(screen.queryByLabelText(removedLabel)).not.toBeInTheDocument()
    }
    expect(
      screen.getByText(
        'No separate quota, group, expiration time, or IP restriction is attached to this key.'
      )
    ).toBeInTheDocument()
  })
})
