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
import { describe, expect, test } from 'vitest'

import type { User } from '../../types'
import {
  transformFormDataToPayload,
  transformUserToFormDefaults,
  USER_FORM_DEFAULT_VALUES,
  userFormSchema,
} from '../user-form'

describe('administrator-provisioned business role mapping', () => {
  test('new accounts default to the student role and use one identifier', () => {
    const payload = transformFormDataToPayload({
      ...USER_FORM_DEFAULT_VALUES,
      username: 'new-user@example.org',
      password: 'password123',
    })

    expect(payload).toMatchObject({
      username: 'new-user@example.org',
      managed_role: 'student',
    })
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('display_name')
    expect(payload).not.toHaveProperty('account_type')
  })

  test('teacher role survives edit form round trips', () => {
    const user: User = {
      id: 7,
      username: 'teacher-user',
      display_name: 'Teacher User',
      quota: 0,
      used_quota: 0,
      request_count: 0,
      status: 1,
      role: 1,
      account_type: 'teacher',
      managed_role: 'teacher',
    }

    const defaults = transformUserToFormDefaults(user)
    const payload = transformFormDataToPayload(defaults, user.id)

    expect(defaults.managed_role).toBe('teacher')
    expect(payload.managed_role).toBe('teacher')
  })

  test('graduate student role survives edit form round trips', () => {
    const user: User = {
      id: 8,
      username: 'graduate-user',
      display_name: 'Graduate User',
      quota: 0,
      used_quota: 0,
      request_count: 0,
      status: 1,
      role: 1,
      account_type: 'graduate',
      managed_role: 'graduate',
    }

    const defaults = transformUserToFormDefaults(user)
    const payload = transformFormDataToPayload(defaults, user.id)

    expect(defaults.managed_role).toBe('graduate')
    expect(payload.managed_role).toBe('graduate')
  })

  test('unknown business roles are rejected by the form schema', () => {
    const result = userFormSchema.safeParse({
      ...USER_FORM_DEFAULT_VALUES,
      username: 'invalid-user',
      managed_role: 'researcher',
    })

    expect(result.success).toBe(false)
  })
})
