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
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'

export function About() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-3xl px-4 py-16'>
        <div className='bg-card space-y-6 rounded-2xl border p-8 shadow-sm'>
          <h1 className='text-3xl font-semibold'>{t('About')}</h1>
          <p className='text-muted-foreground leading-7'>
            {t(
              'This system is a secondary development based on New API, focused on model API access, quota management, and usage statistics.'
            )}
          </p>
          <p className='text-muted-foreground leading-7'>
            {t('New API is developed and maintained by')}{' '}
            <a
              href='https://github.com/QuantumNous/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary font-medium hover:underline'
            >
              QuantumNous
            </a>
            . {t('This secondary development follows the original license.')}
          </p>
          <p className='text-muted-foreground leading-7'>
            {t('Secondary development author email')}:{' '}
            <a
              href='mailto:2510103047@mails.szu.edu.cn'
              className='text-primary font-medium hover:underline'
            >
              2510103047@mails.szu.edu.cn
            </a>
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
