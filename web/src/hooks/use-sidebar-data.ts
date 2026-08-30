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
import {
  Activity,
  FileText,
  Gift,
  Key,
  ReceiptText,
  Ticket,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SidebarData } from '@/components/layout/types'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Root navigation groups for the application sidebar.
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()
  const role = useAuthStore((state) => state.auth.user?.role ?? ROLE.GUEST)
  const isAdmin = role >= ROLE.ADMIN

  const items = [
    {
      title: t('Usage Information'),
      url: '/dashboard/models',
      icon: Activity,
    },
    {
      title: t('API Keys'),
      url: '/keys',
      icon: Key,
    },
    ...(isAdmin
      ? [
          {
            title: t('Generate Redemption Codes'),
            url: '/redemption-codes',
            icon: Ticket,
          },
        ]
      : [
          {
            title: t('Redeem Code'),
            url: '/wallet?view=redeem',
            icon: Gift,
          },
        ]),
    {
      title: t('Account Billing'),
      url: '/wallet?view=billing',
      icon: isAdmin ? FileText : ReceiptText,
    },
    ...(isAdmin
      ? [
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
        ]
      : []),
  ]

  return {
    navGroups: [
      {
        id: 'szu-core',
        title: t('Core Features'),
        items,
      },
    ],
  }
}
