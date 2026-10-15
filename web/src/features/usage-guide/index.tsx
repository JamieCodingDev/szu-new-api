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
  BookOpen,
  Bot,
  Braces,
  KeyRound,
  Route,
  ShieldCheck,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { renderGuideTemplate } from './config'
import { ConnectionCardEditor } from './connection-card-editor'
import { ProviderCardEditor } from './provider-card-editor'
import type { GuideCardId, GuideSetting, UsageGuideConfig } from './types'
import { useUsageGuideConfig } from './use-usage-guide-config'

const CARD_META: { id: GuideCardId; icon: LucideIcon }[] = [
  { id: 'opencode', icon: Braces },
  { id: 'codex', icon: Bot },
  { id: 'claude-code', icon: Route },
  { id: 'deepseek-harness', icon: SquareTerminal },
]

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className='space-y-2'>
      {label ? (
        <p className='text-muted-foreground text-xs font-medium'>{label}</p>
      ) : null}
      <div className='bg-muted/50 relative overflow-hidden rounded-lg border'>
        <pre className='overflow-x-auto p-4 pr-12 text-xs leading-6 sm:text-sm'>
          <code>{code}</code>
        </pre>
        <CopyButton
          value={code}
          className='bg-background/80 absolute top-2 right-2'
        />
      </div>
    </div>
  )
}

function GuideStep({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <li className='grid gap-3 sm:grid-cols-[2rem_minmax(0,1fr)]'>
      <span className='bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-sm font-semibold'>
        {number}
      </span>
      <div className='min-w-0 space-y-3 pt-1'>
        <h3 className='font-medium'>{title}</h3>
        <div className='text-muted-foreground space-y-3 leading-6'>
          {children}
        </div>
      </div>
    </li>
  )
}

function ProviderGuide({
  id,
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  id: string
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card id={id} className='scroll-mt-24'>
      <CardHeader className='border-b pb-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex items-start gap-3'>
            <span className='bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl'>
              <Icon className='size-5' />
            </span>
            <div className='space-y-1'>
              <CardTitle className='text-xl'>{title}</CardTitle>
              <CardDescription className='leading-6'>
                {description}
              </CardDescription>
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        <ol className='space-y-7'>{children}</ol>
      </CardContent>
    </Card>
  )
}

function ConnectionValue({ label, value }: Omit<GuideSetting, 'id'>) {
  return (
    <div className='bg-muted/40 rounded-lg border p-4'>
      <p className='text-muted-foreground text-xs font-medium'>{label}</p>
      <div className='mt-2 flex items-center gap-2'>
        <code className='min-w-0 flex-1 text-sm font-medium break-all'>
          {value}
        </code>
        <CopyButton value={value} />
      </div>
    </div>
  )
}

function SettingsList({ items }: { items: GuideSetting[] }) {
  return (
    <div className='grid gap-2'>
      {items.map((item) => (
        <ConnectionValue key={item.id} {...item} />
      ))}
    </div>
  )
}

function render(value: string, config: UsageGuideConfig) {
  return renderGuideTemplate(value, config)
}

export function UsageGuide() {
  const { t } = useTranslation()
  const { config, isSaving, saveConnection, saveCard } = useUsageGuideConfig()
  const connection = config.connection

  return (
    <PublicLayout>
      <div className='mx-auto max-w-6xl space-y-8 py-8'>
        <header className='space-y-3'>
          <div className='text-primary flex items-center gap-2 text-sm font-medium'>
            <BookOpen className='size-4' />
            {t('Client Setup Guide')}
          </div>
          <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>
            {t('Usage Guide')}
          </h1>
          <p className='text-muted-foreground max-w-3xl text-base leading-7'>
            {t(
              'Connect OpenCode, Codex, Claude Code, and DeepSeek Harness to the SZU New API service.'
            )}
          </p>
        </header>

        <nav
          aria-label={t('Client Setup Guide')}
          className='flex flex-wrap gap-2'
        >
          {CARD_META.map(({ id }) => (
            <a
              key={id}
              href={`#${id}`}
              className='bg-muted hover:bg-accent rounded-full border px-4 py-2 text-sm font-medium transition-colors'
            >
              {config.cards[id].title}
            </a>
          ))}
        </nav>

        <Card>
          <CardHeader className='border-b pb-4'>
            <div className='flex items-start justify-between gap-3'>
              <div className='flex items-start gap-3'>
                <span className='bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl'>
                  <KeyRound className='size-5' />
                </span>
                <div className='space-y-1'>
                  <CardTitle className='text-xl'>{connection.title}</CardTitle>
                  <CardDescription className='leading-6'>
                    {connection.description}
                  </CardDescription>
                </div>
              </div>
              <ConnectionCardEditor
                connection={connection}
                isSaving={isSaving}
                onSave={saveConnection}
              />
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-3 md:grid-cols-3'>
              <ConnectionValue
                label={t('Service URL')}
                value={connection.serviceUrl}
              />
              <ConnectionValue
                label={t('OpenAI-compatible Base URL')}
                value={connection.baseUrl}
              />
              <ConnectionValue
                label={t('Model ID')}
                value={connection.modelId}
              />
            </div>
            <div className='border-warning/30 bg-warning/5 text-muted-foreground flex gap-3 rounded-lg border p-4 text-sm leading-6'>
              <ShieldCheck className='text-warning mt-0.5 size-5 shrink-0' />
              <p>{connection.notice}</p>
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-6'>
          {CARD_META.map(({ id, icon }) => {
            const card = config.cards[id]
            return (
              <ProviderGuide
                key={id}
                id={id}
                icon={icon}
                title={card.title}
                description={card.description}
                action={
                  <ProviderCardEditor
                    card={card}
                    isSaving={isSaving}
                    onSave={(nextCard) => saveCard(id, nextCard)}
                  />
                }
              >
                {card.steps.map((step, index) => (
                  <GuideStep
                    key={step.id}
                    number={index + 1}
                    title={render(step.title, config)}
                  >
                    {step.text ? <p>{render(step.text, config)}</p> : null}
                    {step.settings.length ? (
                      <SettingsList
                        items={step.settings.map((setting) => ({
                          id: setting.id,
                          label: render(setting.label, config),
                          value: render(setting.value, config),
                        }))}
                      />
                    ) : null}
                    {step.code ? (
                      <CodeBlock
                        code={render(step.code, config)}
                        label={render(step.codeLabel, config) || undefined}
                      />
                    ) : null}
                  </GuideStep>
                ))}
              </ProviderGuide>
            )
          })}
        </div>

        <div className='bg-muted/40 flex gap-3 rounded-xl border p-5 text-sm leading-6'>
          <ShieldCheck className='text-primary mt-0.5 size-5 shrink-0' />
          <p className='text-muted-foreground'>
            {render(config.footer, config)}
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
