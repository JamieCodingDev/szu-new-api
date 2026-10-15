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
import { Loader2, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useIsAdmin } from '@/hooks/use-admin'

import type { GuideConnectionCard } from './types'

interface ConnectionCardEditorProps {
  connection: GuideConnectionCard
  isSaving: boolean
  onSave: (connection: GuideConnectionCard) => Promise<boolean>
}

export function ConnectionCardEditor({
  connection,
  isSaving,
  onSave,
}: ConnectionCardEditorProps) {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => structuredClone(connection))

  if (!isAdmin) return null

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraft(structuredClone(connection))
    setOpen(nextOpen)
  }

  const update = (field: keyof GuideConnectionCard, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const handleSave = async () => {
    if (await onSave(draft)) setOpen(false)
  }

  const canSave =
    draft.title.trim() &&
    draft.serviceUrl.trim() &&
    draft.baseUrl.trim() &&
    draft.modelId.trim()

  return (
    <>
      <Button
        variant='outline'
        size='sm'
        aria-label={t('Edit {{title}}', { title: connection.title })}
        onClick={() => handleOpenChange(true)}
      >
        <Pencil className='size-4' />
        {t('Edit')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        title={t('Edit {{title}}', { title: connection.title })}
        description={t(
          'Changing the Base URL or model ID updates every configuration example below.'
        )}
        contentHeight='min(65vh, 42rem)'
        footer={
          <>
            <Button
              variant='outline'
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              {t('Cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !canSave}>
              {isSaving ? <Loader2 className='size-4 animate-spin' /> : null}
              {t('Save')}
            </Button>
          </>
        }
      >
        <div className='grid gap-5 sm:grid-cols-2'>
          <EditorField id='guide-connection-title' label={t('Title')}>
            <Input
              id='guide-connection-title'
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
            />
          </EditorField>
          <EditorField id='guide-service-url' label={t('Service URL')}>
            <Input
              id='guide-service-url'
              value={draft.serviceUrl}
              onChange={(event) => update('serviceUrl', event.target.value)}
            />
          </EditorField>
          <EditorField
            id='guide-connection-description'
            label={t('Description')}
            className='sm:col-span-2'
          >
            <Textarea
              id='guide-connection-description'
              value={draft.description}
              onChange={(event) => update('description', event.target.value)}
              className='min-h-20'
            />
          </EditorField>
          <EditorField
            id='guide-base-url'
            label={t('OpenAI-compatible Base URL')}
          >
            <Input
              id='guide-base-url'
              value={draft.baseUrl}
              onChange={(event) => update('baseUrl', event.target.value)}
            />
          </EditorField>
          <EditorField id='guide-model-id' label={t('Model ID')}>
            <Input
              id='guide-model-id'
              value={draft.modelId}
              onChange={(event) => update('modelId', event.target.value)}
            />
          </EditorField>
          <EditorField
            id='guide-connection-notice'
            label={t('Notice')}
            className='sm:col-span-2'
          >
            <Textarea
              id='guide-connection-notice'
              value={draft.notice}
              onChange={(event) => update('notice', event.target.value)}
              className='min-h-20'
            />
          </EditorField>
        </div>
      </Dialog>
    </>
  )
}

function EditorField({
  id,
  label,
  className,
  children,
}: {
  id: string
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
