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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  SideDrawerSection,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  EMPTY_PERMISSION_CATALOG,
  hasPermission,
  normalizeAdminPermissions,
} from '@/lib/admin-permissions'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  createUser,
  updateUser,
  getUser,
  getPermissionCatalog,
  getMonthlyQuotaDefaults,
  MONTHLY_QUOTA_DEFAULTS_QUERY_KEY,
} from '../api'
import {
  BINDING_FIELDS,
  ERROR_MESSAGES,
  MANAGED_ROLES,
  SUCCESS_MESSAGES,
} from '../constants'
import {
  userFormSchema,
  type UserFormValues,
  USER_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformUserToFormDefaults,
} from '../lib'
import { resolveMonthlyQuota } from '../lib/monthly-quota'
import type { User } from '../types'
import { useUsers } from './users-provider'

type UsersMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: User
}

export function UsersMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: UsersMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useUsers()
  const currentUser = useAuthStore((s) => s.auth.user)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Permission catalog is owned by the backend; fetched once and reused.
  const { data: permissionCatalog = EMPTY_PERMISSION_CATALOG } = useQuery({
    queryKey: ['admin-permission-catalog'],
    queryFn: getPermissionCatalog,
    staleTime: 5 * 60 * 1000,
  })

  const { data: monthlyQuotaDefaults } = useQuery({
    queryKey: MONTHLY_QUOTA_DEFAULTS_QUERY_KEY,
    queryFn: getMonthlyQuotaDefaults,
    staleTime: 60 * 1000,
  })

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: USER_FORM_DEFAULT_VALUES,
  })

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      // For update, fetch fresh data
      getUser(currentRow.id)
        .then((result) => {
          if (result.success && result.data) {
            form.reset(transformUserToFormDefaults(result.data))
          }
        })
        .catch(() => toast.error(t(ERROR_MESSAGES.UNEXPECTED)))
    } else if (open && !isUpdate) {
      // For create, reset to defaults
      form.reset(USER_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form, t])

  const selectedRole = form.watch('managed_role')
  const canEditAdminPermissions = currentUser?.role === ROLE.SUPER_ADMIN
  const targetIsAdmin = selectedRole === 'admin'
  const selectedMonthlyQuota = resolveMonthlyQuota(
    monthlyQuotaDefaults,
    selectedRole
  )

  const onSubmit = async (data: UserFormValues) => {
    if (!isUpdate) {
      const passwordLength = data.password?.length || 0
      if (passwordLength < 8 || passwordLength > 20) {
        form.setError('password', {
          type: 'manual',
          message: t('Password must be between 8 and 20 characters'),
        })
        return
      }
    }

    setIsSubmitting(true)
    try {
      const payload = transformFormDataToPayload(
        data,
        currentRow?.id,
        permissionCatalog
      )
      const result = isUpdate
        ? await updateUser(payload as typeof payload & { id: number })
        : await createUser(payload)

      if (result.success) {
        toast.success(
          isUpdate
            ? t(SUCCESS_MESSAGES.USER_UPDATED)
            : t(SUCCESS_MESSAGES.USER_CREATED)
        )
        onOpenChange(false)
        triggerRefresh()
      } else {
        toast.error(
          result.message ||
            (isUpdate
              ? t(ERROR_MESSAGES.UPDATE_FAILED)
              : t(ERROR_MESSAGES.CREATE_FAILED))
        )
      }
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          form.reset()
        }
      }}
    >
      <SheetContent className={sideDrawerContentClassName('sm:max-w-[600px]')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isUpdate ? t('Update') : t('Create')} {t('User')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update the user by providing necessary info.')
              : t('Add a new user by providing necessary info.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='user-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className={sideDrawerFormClassName()}
          >
            {/* Basic Information */}
            <SideDrawerSection>
              <h3 className='text-sm font-medium'>{t('Basic Information')}</h3>

              <FormField
                control={form.control}
                name='username'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Username / Email')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('Enter username or email')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='managed_role'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Role')}</FormLabel>
                    <Select
                      items={Object.values(MANAGED_ROLES).map((item) => ({
                        value: item.value,
                        label: t(item.labelKey),
                      }))}
                      onValueChange={(value) =>
                        value !== null && field.onChange(value)
                      }
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select a role')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {Object.values(MANAGED_ROLES).map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {t(item.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(
                        'Role controls account permissions and queue priority'
                      )}
                    </FormDescription>
                    {selectedMonthlyQuota !== undefined && (
                      <div className='bg-muted/50 rounded-md border px-3 py-2 text-sm'>
                        <span className='text-muted-foreground'>
                          {t('Current monthly free quota')}:{' '}
                        </span>
                        <span className='font-medium tabular-nums'>
                          {selectedMonthlyQuota.toLocaleString()}{' '}
                          {t('quota points')}
                        </span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Password')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type='password'
                        placeholder={
                          isUpdate
                            ? t('Leave empty to keep unchanged')
                            : t('Enter password (8-20 characters)')
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            {/* Notes only. Quota is issued exclusively by the monthly grant
			    and redemption codes; users do not have configurable groups. */}
            {isUpdate && (
              <SideDrawerSection>
                <h3 className='text-sm font-medium'>{t('User Settings')}</h3>
                <FormField
                  control={form.control}
                  name='remark'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Remark')}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={t(
                            'Admin notes (only visible to admins)'
                          )}
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SideDrawerSection>
            )}

            {canEditAdminPermissions &&
              targetIsAdmin &&
              permissionCatalog.resources.length > 0 && (
                <SideDrawerSection>
                  <h3 className='text-sm font-medium'>
                    {t('Admin Permissions')}
                  </h3>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Default administrator permissions can be overridden for this user.'
                    )}
                  </p>
                  <FormField
                    control={form.control}
                    name='admin_permissions'
                    render={({ field }) => {
                      const selected = normalizeAdminPermissions(
                        field.value,
                        permissionCatalog
                      )
                      return (
                        <FormItem>
                          <div className='space-y-3'>
                            {permissionCatalog.resources.map((resource) => (
                              <div
                                key={resource.resource}
                                className='space-y-2 rounded-md border p-3'
                              >
                                <div className='text-sm font-medium'>
                                  {t(resource.label_key)}
                                </div>
                                <div className='space-y-2'>
                                  {resource.actions.map((option) => (
                                    <label
                                      key={option.action}
                                      className='flex items-start gap-3'
                                    >
                                      <Checkbox
                                        checked={
                                          selected[resource.resource]?.[
                                            option.action
                                          ] === true
                                        }
                                        onCheckedChange={(checked) => {
                                          field.onChange({
                                            ...selected,
                                            [resource.resource]: {
                                              ...selected[resource.resource],
                                              [option.action]: checked === true,
                                            },
                                          })
                                        }}
                                      />
                                      <span className='flex flex-col gap-1'>
                                        <span className='text-sm font-medium'>
                                          {t(option.label_key)}
                                        </span>
                                        <span className='text-muted-foreground text-xs'>
                                          {t(option.description_key)}
                                        </span>
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                  {currentUser && (
                    <p className='text-muted-foreground text-xs'>
                      {hasPermission(
                        currentUser,
                        ADMIN_PERMISSION_RESOURCES.CHANNEL,
                        ADMIN_PERMISSION_ACTIONS.SENSITIVE_WRITE
                      )
                        ? t('Your account can edit sensitive channel settings.')
                        : t(
                            'Your account cannot edit sensitive channel settings.'
                          )}
                    </p>
                  )}
                </SideDrawerSection>
              )}

            {/* Binding Information (Read-only) */}
            {isUpdate && (
              <SideDrawerSection>
                <h3 className='text-sm font-medium'>
                  {t('Binding Information')}
                </h3>
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'Third-party account bindings (read-only, managed by user in profile settings)'
                  )}
                </p>

                <div className='flex flex-col gap-3'>
                  {BINDING_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <Label className='text-muted-foreground text-xs'>
                        {t(label)}
                      </Label>
                      <Input
                        value={
                          (currentRow?.[key as keyof User] as string) || '-'
                        }
                        disabled
                        className='mt-1'
                      />
                    </div>
                  ))}
                </div>
              </SideDrawerSection>
            )}
          </form>
        </Form>
        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose render={<Button variant='outline' />}>
            {t('Close')}
          </SheetClose>
          <Button form='user-form' type='submit' disabled={isSubmitting}>
            {isSubmitting ? t('Saving...') : t('Save changes')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
