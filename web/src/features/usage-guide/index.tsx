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

const SERVICE_URL = 'http://172.31.233.175:3000'
const OPENAI_BASE_URL = `${SERVICE_URL}/v1`
const MODEL_ID = 'deepseek-v4-flash'

const OPENCODE_CONFIG = `{
  "$schema": "https://opencode.ai/config.json",
  "model": "szu/deepseek-v4-flash",
  "provider": {
    "szu": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "SZU New API",
      "options": {
        "baseURL": "http://172.31.233.175:3000/v1"
      },
      "models": {
        "deepseek-v4-flash": {
          "name": "DeepSeek V4 Flash",
          "limit": {
            "context": 262144,
            "output": 32768
          }
        }
      }
    }
  }
}`

const CODEX_CONFIG = `model_provider = "szu"
model = "deepseek-v4-flash"

[model_providers.szu]
name = "SZU New API"
base_url = "http://172.31.233.175:3000/v1"
env_key = "SZU_NEW_API_KEY"
wire_api = "responses"`

const CODEX_WINDOWS_KEY = `[Environment]::SetEnvironmentVariable(
  "SZU_NEW_API_KEY",
  "sk-替换为你的 API 密钥",
  "User"
)`

const CODEX_UNIX_KEY = `echo 'export SZU_NEW_API_KEY="sk-替换为你的 API 密钥"' >> ~/.bashrc
source ~/.bashrc`

interface CodeBlockProps {
  code: string
  label?: string
}

function CodeBlock({ code, label }: CodeBlockProps) {
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

interface GuideStepProps {
  number: number
  title: string
  children: ReactNode
}

function GuideStep({ number, title, children }: GuideStepProps) {
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

interface ProviderGuideProps {
  id: string
  icon: LucideIcon
  title: string
  description: string
  children: ReactNode
}

function ProviderGuide({
  id,
  icon: Icon,
  title,
  description,
  children,
}: ProviderGuideProps) {
  return (
    <Card id={id} className='scroll-mt-24'>
      <CardHeader className='border-b pb-4'>
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
      </CardHeader>
      <CardContent>
        <ol className='space-y-7'>{children}</ol>
      </CardContent>
    </Card>
  )
}

interface ConnectionValueProps {
  label: string
  value: string
}

function ConnectionValue({ label, value }: ConnectionValueProps) {
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

interface SettingsListProps {
  items: ConnectionValueProps[]
}

function SettingsList({ items }: SettingsListProps) {
  return (
    <div className='grid gap-2'>
      {items.map((item) => (
        <ConnectionValue
          key={`${item.label}-${item.value}`}
          label={item.label}
          value={item.value}
        />
      ))}
    </div>
  )
}

export function UsageGuide() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-6xl space-y-8 py-8'>
        <div className='space-y-3'>
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
        </div>

        <nav
          aria-label={t('Client Setup Guide')}
          className='flex flex-wrap gap-2'
        >
          {[
            ['OpenCode', 'opencode'],
            ['Codex', 'codex'],
            ['Claude Code', 'claude-code'],
            ['DeepSeek Harness', 'deepseek-harness'],
          ].map(([label, id]) => (
            <a
              key={id}
              href={`#${id}`}
              className='bg-muted hover:bg-accent rounded-full border px-4 py-2 text-sm font-medium transition-colors'
            >
              {label}
            </a>
          ))}
        </nav>

        <Card>
          <CardHeader className='border-b pb-4'>
            <div className='flex items-start gap-3'>
              <span className='bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl'>
                <KeyRound className='size-5' />
              </span>
              <div className='space-y-1'>
                <CardTitle className='text-xl'>
                  {t('Before You Start')}
                </CardTitle>
                <CardDescription className='leading-6'>
                  {t(
                    'Create an API key on the API Keys page, then use these shared connection values.'
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-3 md:grid-cols-3'>
              <ConnectionValue label={t('Service URL')} value={SERVICE_URL} />
              <ConnectionValue
                label={t('OpenAI-compatible Base URL')}
                value={OPENAI_BASE_URL}
              />
              <ConnectionValue label={t('Model ID')} value={MODEL_ID} />
            </div>
            <div className='border-warning/30 bg-warning/5 text-muted-foreground flex gap-3 rounded-lg border p-4 text-sm leading-6'>
              <ShieldCheck className='text-warning mt-0.5 size-5 shrink-0' />
              <p>
                {t(
                  'Replace every API key placeholder with a key created by your account. Never commit an API key to a repository or share it in screenshots.'
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-6'>
          <ProviderGuide
            id='opencode'
            icon={Braces}
            title='OpenCode'
            description={t(
              'OpenCode uses the OpenAI-compatible Chat Completions endpoint.'
            )}
          >
            <GuideStep number={1} title={t('Install')}>
              <CodeBlock code='npm install -g opencode-ai' />
            </GuideStep>
            <GuideStep number={2} title={t('Save the API key')}>
              <p>
                {t(
                  'Run OpenCode, enter /connect, select Other, use szu as the provider ID, and paste your API key.'
                )}
              </p>
              <CodeBlock code={'opencode\n/connect'} />
            </GuideStep>
            <GuideStep number={3} title={t('Configure the provider')}>
              <p>
                {t(
                  'Create opencode.json in the project directory with the following content.'
                )}
              </p>
              <CodeBlock code={OPENCODE_CONFIG} label='opencode.json' />
            </GuideStep>
            <GuideStep number={4} title={t('Start and select the model')}>
              <p>
                {t(
                  'Start OpenCode in the project directory. If needed, enter /models and select szu/deepseek-v4-flash.'
                )}
              </p>
              <CodeBlock code={'opencode\n/models'} />
            </GuideStep>
          </ProviderGuide>

          <ProviderGuide
            id='codex'
            icon={Bot}
            title='Codex'
            description={t(
              'Codex uses the Responses API. Configure the custom provider in the user-level config file.'
            )}
          >
            <GuideStep number={1} title={t('Install')}>
              <CodeBlock code='npm install -g @openai/codex' />
            </GuideStep>
            <GuideStep number={2} title={t('Persist the API key')}>
              <p>
                {t(
                  'Choose the command for your operating system, replace the placeholder, and restart the terminal after saving.'
                )}
              </p>
              <div className='grid gap-3 lg:grid-cols-2'>
                <CodeBlock
                  code={CODEX_WINDOWS_KEY}
                  label='Windows PowerShell'
                />
                <CodeBlock code={CODEX_UNIX_KEY} label='Linux / macOS (Bash)' />
              </div>
            </GuideStep>
            <GuideStep number={3} title={t('Configure the provider')}>
              <p>
                {t(
                  'Create or edit the user-level Codex configuration file at ~/.codex/config.toml. On Windows, use $env:USERPROFILE\\.codex\\config.toml.'
                )}
              </p>
              <CodeBlock code={CODEX_CONFIG} label='config.toml' />
            </GuideStep>
            <GuideStep number={4} title={t('Start')}>
              <p>
                {t(
                  'Because the provider and model are already defaults, codex is enough. The explicit model command is also available.'
                )}
              </p>
              <CodeBlock
                code={'codex\n# or\ncodex --model deepseek-v4-flash'}
              />
            </GuideStep>
          </ProviderGuide>

          <ProviderGuide
            id='claude-code'
            icon={Route}
            title='Claude Code'
            description={t(
              'Claude Code uses the verified CC Switch local routing setup to reach the OpenAI-compatible endpoint.'
            )}
          >
            <GuideStep number={1} title={t('Install')}>
              <CodeBlock code='npm install -g @anthropic-ai/claude-code' />
            </GuideStep>
            <GuideStep number={2} title={t('Add a provider in CC Switch')}>
              <p>
                {t(
                  'Create a Claude provider and fill in the following values. Enable Full URL for the request address.'
                )}
              </p>
              <SettingsList
                items={[
                  {
                    label: t('Provider name'),
                    value: 'DeepSeek V4 Flash SZU',
                  },
                  {
                    label: t('API Key'),
                    value: 'sk-替换为你的 API 密钥',
                  },
                  {
                    label: t('Request URL'),
                    value: `${OPENAI_BASE_URL}/chat/completions`,
                  },
                  {
                    label: t('API format'),
                    value: t('OpenAI Chat Completions'),
                  },
                  {
                    label: t('Authentication field'),
                    value: 'ANTHROPIC_AUTH_TOKEN',
                  },
                ]}
              />
            </GuideStep>
            <GuideStep number={3} title={t('Configure model mapping')}>
              <p>
                {t(
                  'Map the primary, Haiku, Sonnet, and Opus models to deepseek-v4-flash, then save the provider.'
                )}
              </p>
              <SettingsList
                items={[
                  { label: t('Primary model'), value: MODEL_ID },
                  { label: 'Haiku', value: MODEL_ID },
                  { label: 'Sonnet', value: MODEL_ID },
                  { label: 'Opus', value: MODEL_ID },
                ]}
              />
            </GuideStep>
            <GuideStep number={4} title={t('Enable routing and start')}>
              <p>
                {t(
                  'In CC Switch, enable the local routing master switch and the Claude route. Keep CC Switch running while using Claude Code.'
                )}
              </p>
              <CodeBlock
                code={
                  '# Local routing service\nhttp://127.0.0.1:15721\n\nclaude --model sonnet'
                }
              />
            </GuideStep>
          </ProviderGuide>

          <ProviderGuide
            id='deepseek-harness'
            icon={SquareTerminal}
            title='DeepSeek Harness'
            description={t(
              'DeepSeek Harness can be started directly with Node.js and configured from its Web UI.'
            )}
          >
            <GuideStep number={1} title={t('Start the Web UI')}>
              <CodeBlock code='npx @deepseek-ai/dsh web' />
              <p>
                {t('The Web UI opens at http://127.0.0.1:3080 by default.')}
              </p>
            </GuideStep>
            <GuideStep number={2} title={t('Configure the provider')}>
              <p>
                {t(
                  'Open Settings, select Models, edit DeepSeek, enter your API key, and expand Custom Settings.'
                )}
              </p>
              <SettingsList
                items={[
                  {
                    label: t('API Key'),
                    value: 'sk-替换为你的 API 密钥',
                  },
                  { label: t('Base URL'), value: OPENAI_BASE_URL },
                ]}
              />
            </GuideStep>
            <GuideStep number={3} title={t('Configure the model catalog')}>
              <p>
                {t(
                  'Add the model ID below to the model catalog, set any display name you prefer, and save.'
                )}
              </p>
              <SettingsList
                items={[
                  { label: t('Model ID'), value: MODEL_ID },
                  {
                    label: t('Display name'),
                    value: 'DeepSeek V4 Flash SZU',
                  },
                ]}
              />
            </GuideStep>
            <GuideStep number={4} title={t('Start a session')}>
              <p>
                {t(
                  'Create or open a workspace, select deepseek-v4-flash in the model selector, and send a test message.'
                )}
              </p>
            </GuideStep>
          </ProviderGuide>
        </div>

        <div className='bg-muted/40 flex gap-3 rounded-xl border p-5 text-sm leading-6'>
          <ShieldCheck className='text-primary mt-0.5 size-5 shrink-0' />
          <p className='text-muted-foreground'>
            {t(
              'If setup fails, verify the service URL, API key, and model ID first. A successful GET /v1/models response confirms that the address and key are valid.'
            )}
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
