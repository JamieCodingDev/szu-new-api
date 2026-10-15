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
export interface UsageGuideResponse {
  success: boolean
  message?: string
  data: UsageGuideCards
}

export interface GuideSetting {
  id: string
  label: string
  value: string
}

export interface GuideStep {
  id: string
  title: string
  text: string
  code: string
  codeLabel: string
  settings: GuideSetting[]
}

export interface GuideCard {
  title: string
  description: string
  steps: GuideStep[]
}

export interface GuideConnectionCard {
  title: string
  description: string
  serviceUrl: string
  baseUrl: string
  modelId: string
  notice: string
}

export type GuideCardId =
  | 'opencode'
  | 'codex'
  | 'claude-code'
  | 'deepseek-harness'

export type GuideStorageCardId = GuideCardId | 'before-start'

export type UsageGuideCards = Partial<Record<GuideStorageCardId, string>>

export interface UsageGuideConfig {
  version: 1
  connection: GuideConnectionCard
  cards: Record<GuideCardId, GuideCard>
  footer: string
}
