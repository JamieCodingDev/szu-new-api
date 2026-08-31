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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  getMonthlyQuotaDefaults,
  MONTHLY_QUOTA_DEFAULTS_QUERY_KEY,
  updateMonthlyQuotaDefaults,
} from '../api'
import type { MonthlyQuotaDefaults } from '../types'

const MAX_MONTHLY_QUOTA = Number.MAX_SAFE_INTEGER
const EMPTY_FORM = { student: '', teacher: '', admin: '' }

type MonthlyQuotaForm = Record<keyof MonthlyQuotaDefaults, string>

interface MonthlyQuotaDefaultsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MonthlyQuotaDefaultsDialog({
  open,
  onOpenChange,
}: MonthlyQuotaDefaultsDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<MonthlyQuotaForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const defaultsQuery = useQuery({
    queryKey: MONTHLY_QUOTA_DEFAULTS_QUERY_KEY,
    queryFn: getMonthlyQuotaDefaults,
    enabled: open,
  })

  useEffect(() => {
    if (!open || !defaultsQuery.data) return
    setForm({
      student: String(defaultsQuery.data.student),
      teacher: String(defaultsQuery.data.teacher),
      admin: String(defaultsQuery.data.admin),
    })
  }, [open, defaultsQuery.data])

  const setValue = (role: keyof MonthlyQuotaDefaults, value: string) => {
    setForm((current) => ({ ...current, [role]: value }))
  }

  const handleSave = async () => {
    const values: MonthlyQuotaDefaults = {
      student: Number(form.student),
      teacher: Number(form.teacher),
      admin: Number(form.admin),
    }
    if (
      Object.values(values).some(
        (value) =>
          !Number.isSafeInteger(value) || value < 1 || value > MAX_MONTHLY_QUOTA
      )
    ) {
      toast.error(t('Each monthly quota must be a positive whole number'))
      return
    }

    setSaving(true)
    try {
      const result = await updateMonthlyQuotaDefaults(values)
      if (!result.success || !result.data) {
        toast.error(result.message || t('Failed to update monthly quotas'))
        return
      }
      queryClient.setQueryData(MONTHLY_QUOTA_DEFAULTS_QUERY_KEY, result.data)
      toast.success(t('Monthly quota defaults updated'))
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to update monthly quotas')
      )
    } finally {
      setSaving(false)
    }
  }

  const fields: Array<{
    role: keyof MonthlyQuotaDefaults
    label: string
  }> = [
    { role: 'student', label: t('Student Monthly Quota') },
    { role: 'teacher', label: t('Teacher Monthly Quota') },
    { role: 'admin', label: t('Administrator Monthly Quota') },
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Monthly Quota Settings')}
      description={t('Configure the monthly free quota granted to each role.')}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || defaultsQuery.isLoading}
          >
            {saving && <Loader2 className='h-4 w-4 animate-spin' />}
            {saving ? t('Saving...') : t('Save changes')}
          </Button>
        </>
      }
    >
      {defaultsQuery.isLoading && (
        <div className='text-muted-foreground flex min-h-40 items-center justify-center gap-2 text-sm'>
          <Loader2 className='h-4 w-4 animate-spin' />
          {t('Loading...')}
        </div>
      )}
      {defaultsQuery.isError && (
        <div className='text-destructive py-8 text-center text-sm'>
          {t('Failed to load monthly quota settings')}
        </div>
      )}
      {!defaultsQuery.isLoading && !defaultsQuery.isError && (
        <div className='space-y-4'>
          {fields.map(({ role, label }) => (
            <div key={role} className='space-y-2'>
              <Label htmlFor={`monthly-quota-${role}`}>{label}</Label>
              <Input
                id={`monthly-quota-${role}`}
                type='number'
                inputMode='numeric'
                min={1}
                max={MAX_MONTHLY_QUOTA}
                step={1}
                value={form[role]}
                onChange={(event) => setValue(role, event.target.value)}
              />
              <p className='text-muted-foreground text-xs'>
                {(Number(form[role]) || 0).toLocaleString()} {t('quota points')}
              </p>
            </div>
          ))}

          <div className='bg-muted/50 text-muted-foreground rounded-lg border p-3 text-xs leading-relaxed'>
            {t(
              "Changes apply to monthly grants for all users. Increasing a value tops up only the current month's difference; decreasing it never deducts quota already granted."
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
