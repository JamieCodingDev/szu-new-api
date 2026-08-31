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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { MonthlyQuotaDefaultsDialog } =
  await import('../monthly-quota-defaults-dialog')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

type ApiGet = (url: string) => Promise<{ data: unknown }>
type ApiPut = (url: string, data: unknown) => Promise<{ data: unknown }>
type MockableApi = { get: ApiGet; put: ApiPut }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPut = apiClient.put
let queryClient: InstanceType<typeof QueryClient> | null = null

afterEach(() => {
  apiClient.get = originalGet
  apiClient.put = originalPut
  queryClient?.clear()
  queryClient = null
})

describe('monthly quota defaults dialog', () => {
  test('loads and atomically saves all role defaults', async () => {
    let submitted: unknown
    apiClient.get = async () => ({
      data: {
        success: true,
        data: { student: 100000, teacher: 200000, admin: 1000000 },
      },
    })
    apiClient.put = async (_url, data) => {
      submitted = data
      return { data: { success: true, data } }
    }
    const onOpenChange = vi.fn()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <MonthlyQuotaDefaultsDialog open onOpenChange={onOpenChange} />
        </I18nextProvider>
      </QueryClientProvider>
    )

    const studentInput = await screen.findByLabelText('Student Monthly Quota')
    expect(studentInput).toHaveValue(100000)
    await userEvent.clear(studentInput)
    await userEvent.type(studentInput, '120000')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(submitted).toEqual({
        student: 120000,
        teacher: 200000,
        admin: 1000000,
      })
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
