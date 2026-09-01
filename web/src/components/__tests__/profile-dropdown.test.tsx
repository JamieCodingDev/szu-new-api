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
import { fireEvent, render, screen } from '@testing-library/react'
import type { PropsWithChildren, ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/components/sign-out-dialog', () => ({
  SignOutDialog: () => null,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: PropsWithChildren) => <div>{children}</div>,
  AvatarFallback: ({ children }: PropsWithChildren) => <span>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children?: ReactNode }) => (
    <button type='button'>{children}</button>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: PropsWithChildren<{ onClick?: () => void }>) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: PropsWithChildren) => (
    <div>{children}</div>
  ),
}))

vi.mock('@/hooks/use-dialog', () => ({
  default: () => [false, vi.fn()],
}))

vi.mock('@/hooks/use-user-display', () => ({
  useUserDisplay: () => ({
    displayName: 'admin',
    roleLabel: 'Administrator',
  }),
}))

vi.mock('@/lib/avatar', () => ({
  getUserAvatarFallback: () => 'A',
  getUserAvatarStyle: () => ({}),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: {
      auth: { user: { username: string; group: string } }
    }) => unknown
  ) => selector({ auth: { user: { username: 'admin', group: 'default' } } }),
}))

const { ProfileDropdown } = await import('../profile-dropdown')

describe('profile dropdown navigation', () => {
  test('opens the model dashboard from the profile item', () => {
    render(<ProfileDropdown />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/dashboard/$section',
      params: { section: 'models' },
    })
  })
})
