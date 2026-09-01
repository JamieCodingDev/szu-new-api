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
import { afterEach, describe, expect, test } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { UsersProvider } = await import('../users-provider')
const { resolveMonthlyQuota } = await import('../../lib/monthly-quota')
const { UsersMutateDrawer } = await import('../users-mutate-drawer')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

type ApiGet = (url: string) => Promise<{ data: unknown }>
type MockableApi = { get: ApiGet }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
let queryClient: InstanceType<typeof QueryClient> | null = null

function renderCreateDrawer() {
  apiClient.get = async (url) => {
    if (url === '/api/authz/catalog') {
      return {
        data: { success: true, data: { resources: [], roles: [] } },
      }
    }
    if (url === '/api/user/monthly-quota-defaults') {
      return {
        data: {
          success: true,
          data: {
            student: 100000,
            graduate: 100000,
            teacher: 200000,
            admin: 1000000,
          },
        },
      }
    }
    throw new Error(`Unexpected request: ${url}`)
  }
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <UsersProvider>
          <UsersMutateDrawer open onOpenChange={() => undefined} />
        </UsersProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  apiClient.get = originalGet
  queryClient?.clear()
  queryClient = null
})

describe('managed user identity form', () => {
  test('uses the student quota as a compatibility fallback for graduate students', () => {
    expect(
      resolveMonthlyQuota(
        { student: 100000, teacher: 200000, admin: 1000000 },
        'graduate'
      )
    ).toBe(100000)
    expect(
      resolveMonthlyQuota(
        {
          student: 100000,
          graduate: 150000,
          teacher: 200000,
          admin: 1000000,
        },
        'graduate'
      )
    ).toBe(150000)
  })

  test('shows one identifier, one business role, and its global quota', async () => {
    renderCreateDrawer()

    expect(screen.getByLabelText('Username / Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Role')).toBeInTheDocument()
    expect(screen.getByText('Student')).toBeInTheDocument()
    expect(screen.queryByLabelText('Display Name')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Email (optional)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Account Type')).not.toBeInTheDocument()
    expect(await screen.findByText('100,000 quota points')).toBeInTheDocument()
  })
})
