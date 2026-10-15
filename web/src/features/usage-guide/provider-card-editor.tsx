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

import type { GuideCard, GuideSetting, GuideStep } from './types'

interface ProviderCardEditorProps {
  card: GuideCard
  isSaving: boolean
  onSave: (card: GuideCard) => Promise<boolean>
}

export function ProviderCardEditor({
  card,
  isSaving,
  onSave,
}: ProviderCardEditorProps) {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => structuredClone(card))

  if (!isAdmin) return null

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraft(structuredClone(card))
    setOpen(nextOpen)
  }

  const updateStep = (index: number, nextStep: GuideStep) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? nextStep : step
      ),
    }))
  }

  const handleSave = async () => {
    if (await onSave(draft)) setOpen(false)
  }

  return (
    <>
      <Button
        variant='outline'
        size='sm'
        aria-label={t('Edit {{title}}', { title: card.title })}
        onClick={() => handleOpenChange(true)}
      >
        <Pencil className='size-4' />
        {t('Edit')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        title={t('Edit {{title}}', { title: card.title })}
        description={t(
          'Keep template variables in fields that should follow the shared connection settings.'
        )}
        contentClassName='sm:max-w-4xl'
        contentHeight='min(70vh, 48rem)'
        footer={
          <>
            <Button
              variant='outline'
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !draft.title.trim()}
            >
              {isSaving ? <Loader2 className='size-4 animate-spin' /> : null}
              {t('Save')}
            </Button>
          </>
        }
      >
        <div className='space-y-6'>
          <p className='bg-muted text-muted-foreground rounded-md px-3 py-2 font-mono text-xs'>
            {'{{baseUrl}} · {{modelId}} · {{serviceUrl}}'}
          </p>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field id='guide-card-title' label={t('Title')}>
              <Input
                id='guide-card-title'
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </Field>
            <Field id='guide-card-description' label={t('Description')}>
              <Input
                id='guide-card-description'
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          {draft.steps.map((step, index) => (
            <StepEditor
              key={step.id}
              index={index}
              step={step}
              onChange={(nextStep) => updateStep(index, nextStep)}
            />
          ))}
        </div>
      </Dialog>
    </>
  )
}

function StepEditor({
  index,
  step,
  onChange,
}: {
  index: number
  step: GuideStep
  onChange: (step: GuideStep) => void
}) {
  const { t } = useTranslation()
  const update = (field: keyof GuideStep, value: string) => {
    onChange({ ...step, [field]: value })
  }
  const updateSetting = (settingIndex: number, setting: GuideSetting) => {
    onChange({
      ...step,
      settings: step.settings.map((current, index) =>
        index === settingIndex ? setting : current
      ),
    })
  }

  return (
    <section className='space-y-4 rounded-xl border p-4'>
      <h3 className='font-medium'>
        {t('Step {{number}}', { number: index + 1 })}
      </h3>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Field id={`guide-step-${index}-title`} label={t('Title')}>
          <Input
            id={`guide-step-${index}-title`}
            value={step.title}
            onChange={(event) => update('title', event.target.value)}
          />
        </Field>
        <Field id={`guide-step-${index}-code-label`} label={t('Code label')}>
          <Input
            id={`guide-step-${index}-code-label`}
            value={step.codeLabel}
            onChange={(event) => update('codeLabel', event.target.value)}
          />
        </Field>
      </div>
      <Field id={`guide-step-${index}-text`} label={t('Description')}>
        <Textarea
          id={`guide-step-${index}-text`}
          value={step.text}
          onChange={(event) => update('text', event.target.value)}
          className='min-h-20'
        />
      </Field>
      <Field id={`guide-step-${index}-code`} label={t('Code')}>
        <Textarea
          id={`guide-step-${index}-code`}
          value={step.code}
          onChange={(event) => update('code', event.target.value)}
          className='min-h-32 font-mono text-xs'
        />
      </Field>
      {step.settings.map((setting, settingIndex) => (
        <div key={setting.id} className='grid gap-3 sm:grid-cols-2'>
          <Field
            id={`guide-step-${index}-setting-${settingIndex}-label`}
            label={t('Label')}
          >
            <Input
              id={`guide-step-${index}-setting-${settingIndex}-label`}
              value={setting.label}
              onChange={(event) =>
                updateSetting(settingIndex, {
                  ...setting,
                  label: event.target.value,
                })
              }
            />
          </Field>
          <Field
            id={`guide-step-${index}-setting-${settingIndex}-value`}
            label={t('Value')}
          >
            <Input
              id={`guide-step-${index}-setting-${settingIndex}-value`}
              value={setting.value}
              onChange={(event) =>
                updateSetting(settingIndex, {
                  ...setting,
                  value: event.target.value,
                })
              }
            />
          </Field>
        </div>
      ))}
    </section>
  )
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
