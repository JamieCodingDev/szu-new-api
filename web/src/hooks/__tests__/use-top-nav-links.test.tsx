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
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, test } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { useTopNavLinks } = await import('../use-top-nav-links')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

function TranslationProvider(props: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{props.children}</I18nextProvider>
}

describe('minimal top navigation', () => {
  test('places the usage guide immediately before the about entry', () => {
    const { result } = renderHook(() => useTopNavLinks(), {
      wrapper: TranslationProvider,
    })

    expect(result.current).toEqual([
      { title: 'Usage Guide', href: '/usage-guide' },
      { title: 'About', href: '/about' },
    ])
  })
})
