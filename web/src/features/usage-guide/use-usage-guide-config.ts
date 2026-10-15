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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  getUsageGuideCards,
  USAGE_GUIDE_QUERY_KEY,
  updateUsageGuideCard,
} from './api'
import { parseUsageGuideConfig } from './config'
import type {
  GuideConnectionCard,
  GuideCard,
  GuideCardId,
  GuideStorageCardId,
  UsageGuideResponse,
} from './types'

export function useUsageGuideConfig() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: USAGE_GUIDE_QUERY_KEY,
    queryFn: getUsageGuideCards,
    staleTime: 30_000,
  })
  const config = parseUsageGuideConfig(query.data?.data ?? {})
  const updateGuide = useMutation({
    mutationFn: ({
      cardId,
      content,
    }: {
      cardId: GuideStorageCardId
      content: string
    }) => updateUsageGuideCard(cardId, content),
  })

  const save = async (cardId: GuideStorageCardId, value: unknown) => {
    try {
      const response = await updateGuide.mutateAsync({
        cardId,
        content: JSON.stringify(value),
      })
      if (!response.success) {
        toast.error(response.message || t('Save failed'))
        return false
      }

      queryClient.setQueryData<UsageGuideResponse>(
        USAGE_GUIDE_QUERY_KEY,
        response
      )
      toast.success(t('Saved successfully'))
      return true
    } catch {
      toast.error(t('Save failed, please retry'))
      return false
    }
  }

  return {
    config,
    isSaving: updateGuide.isPending,
    saveConnection: (connection: GuideConnectionCard) =>
      save('before-start', connection),
    saveCard: (cardId: GuideCardId, card: GuideCard) => save(cardId, card),
  }
}
