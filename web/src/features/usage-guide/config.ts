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
import { z } from 'zod'

import type { GuideCardId, UsageGuideCards, UsageGuideConfig } from './types'

const settingSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
})
const stepSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  code: z.string(),
  codeLabel: z.string(),
  settings: z.array(settingSchema),
})
export const guideCardSchema = z.object({
  title: z.string(),
  description: z.string(),
  steps: z.array(stepSchema).min(1).max(8),
})

export const guideConnectionCardSchema = z.object({
  title: z.string(),
  description: z.string(),
  serviceUrl: z.string(),
  baseUrl: z.string(),
  modelId: z.string(),
  notice: z.string(),
})

export const DEFAULT_USAGE_GUIDE_CONFIG: UsageGuideConfig = {
  version: 1,
  connection: {
    title: '开始前准备',
    description:
      '创建 API 密钥后统一使用以下连接信息；修改这里会同步更新下方配置。',
    serviceUrl: 'https://llm.snrc.site',
    baseUrl: 'https://llm.snrc.site/v1',
    modelId: 'deepseek-v4-flash',
    notice: '请使用自己创建的 API 密钥，不要将密钥提交到仓库或公开截图。',
  },
  cards: {
    opencode: {
      title: 'OpenCode',
      description: '通过 OpenAI Chat Completions 接入。',
      steps: [
        {
          id: 'opencode-install',
          title: '安装',
          text: '',
          code: 'npm install -g opencode-ai',
          codeLabel: '',
          settings: [],
        },
        {
          id: 'opencode-connect',
          title: '保存 API 密钥',
          text: '运行 OpenCode，输入 /connect，选择 Other，Provider ID 填写 szu。',
          code: 'opencode\n/connect',
          codeLabel: '',
          settings: [],
        },
        {
          id: 'opencode-config',
          title: '配置并启动',
          text: '在项目目录保存为 opencode.json，启动后选择 szu/{{modelId}}。',
          codeLabel: 'opencode.json',
          code: `{
  "$schema": "https://opencode.ai/config.json",
  "model": "szu/{{modelId}}",
  "provider": {
    "szu": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "SZU New API",
      "options": { "baseURL": "{{baseUrl}}" },
      "models": { "{{modelId}}": { "name": "DeepSeek V4 Flash" } }
    }
  }
}`,
          settings: [],
        },
      ],
    },
    codex: {
      title: 'Codex',
      description: '通过 Responses API 接入。',
      steps: [
        {
          id: 'codex-install',
          title: '安装并设置密钥',
          text: '将 API 密钥保存到环境变量 SZU_NEW_API_KEY。',
          code: `npm install -g @openai/codex
$env:SZU_NEW_API_KEY = "你的 API 密钥"`,
          codeLabel: 'Windows PowerShell',
          settings: [],
        },
        {
          id: 'codex-config',
          title: '配置 Provider',
          text: '保存到 ~/.codex/config.toml。',
          codeLabel: 'config.toml',
          code: `model_provider = "szu_new_api"
model = "{{modelId}}"
model_context_window = 131072
model_auto_compact_token_limit = 114688
disable_response_storage = true

[model_providers.szu_new_api]
name = "SZU New API"
base_url = "{{baseUrl}}"
env_key = "SZU_NEW_API_KEY"
wire_api = "responses"
requires_openai_auth = false`,
          settings: [],
        },
        {
          id: 'codex-start',
          title: '启动',
          text: '',
          code: 'codex --model {{modelId}}',
          codeLabel: '',
          settings: [],
        },
      ],
    },
    'claude-code': {
      title: 'Claude Code',
      description: '通过 CC Switch 本地路由接入。',
      steps: [
        {
          id: 'claude-install',
          title: '安装',
          text: '',
          code: 'npm install -g @anthropic-ai/claude-code',
          codeLabel: '',
          settings: [],
        },
        {
          id: 'claude-provider',
          title: '配置 CC Switch',
          text: '新建 Claude Provider，启用 Full URL，并填写以下参数。',
          code: '',
          codeLabel: '',
          settings: [
            {
              id: 'claude-request-url',
              label: '请求地址',
              value: '{{baseUrl}}/chat/completions',
            },
            { id: 'claude-model', label: '模型', value: '{{modelId}}' },
            {
              id: 'claude-api-format',
              label: 'API 格式',
              value: 'OpenAI Chat Completions (Requires Routing)',
            },
          ],
        },
        {
          id: 'claude-start',
          title: '开启路由并启动',
          text: '开启 Routing 主开关和 Claude 路由，保持 CC Switch 运行。',
          code: 'claude --model sonnet',
          codeLabel: '',
          settings: [],
        },
      ],
    },
    'deepseek-harness': {
      title: 'DeepSeek Harness',
      description: '通过 Web UI 配置 OpenAI 兼容接口。',
      steps: [
        {
          id: 'harness-start',
          title: '启动 Web UI',
          text: '默认打开 http://127.0.0.1:3080。',
          code: 'npx @deepseek-ai/dsh web',
          codeLabel: '',
          settings: [],
        },
        {
          id: 'harness-config',
          title: '配置模型',
          text: '进入 Settings > Models > DeepSeek，填写 API 密钥并保存。',
          code: '',
          codeLabel: '',
          settings: [
            { id: 'harness-base-url', label: 'Base URL', value: '{{baseUrl}}' },
            { id: 'harness-model', label: 'Model ID', value: '{{modelId}}' },
          ],
        },
      ],
    },
  },
  footer: '如连接失败，请先确认 {{baseUrl}}/models 可以正常访问。',
}

const CARD_IDS: GuideCardId[] = [
  'opencode',
  'codex',
  'claude-code',
  'deepseek-harness',
]

function parseCard<T>(
  raw: string | undefined,
  schema: z.ZodType<T>,
  fallback: T
) {
  if (!raw?.trim()) return structuredClone(fallback)
  try {
    return schema.parse(JSON.parse(raw))
  } catch {
    return structuredClone(fallback)
  }
}

export function parseUsageGuideConfig(
  storedCards: UsageGuideCards
): UsageGuideConfig {
  const defaults = structuredClone(DEFAULT_USAGE_GUIDE_CONFIG)
  const cards = { ...defaults.cards }

  for (const cardId of CARD_IDS) {
    cards[cardId] = parseCard(
      storedCards[cardId],
      guideCardSchema,
      defaults.cards[cardId]
    )
  }

  return {
    ...defaults,
    connection: parseCard(
      storedCards['before-start'],
      guideConnectionCardSchema,
      defaults.connection
    ),
    cards,
  }
}

export function renderGuideTemplate(
  value: string,
  config: UsageGuideConfig
): string {
  const variables: Record<string, string> = {
    baseUrl: config.connection.baseUrl.replace(/\/$/, ''),
    modelId: config.connection.modelId,
    serviceUrl: config.connection.serviceUrl.replace(/\/$/, ''),
  }

  return value.replaceAll(/\{\{(baseUrl|modelId|serviceUrl)\}\}/g, (_, key) => {
    return variables[key] ?? ''
  })
}
