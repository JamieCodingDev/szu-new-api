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
import { CircleGauge, Gift, Loader2, TicketCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, getSelf } from '@/lib/api'
import { formatNumber, formatTimestamp } from '@/lib/format'

import { useRedemption } from './hooks/use-redemption'
import type { UserWalletData } from './types'

export type SZUWalletView = 'redeem' | 'billing'

interface SZUWalletProps {
  view: SZUWalletView
}

interface QuotaLedgerEntry {
  id: string
  source: 'monthly' | 'redemption'
  amount: number
  created_at: number
  description: string
}

interface QuotaSnapshot {
  availableQuota: number
  entries: QuotaLedgerEntry[]
}

const EMPTY_SNAPSHOT: QuotaSnapshot = { availableQuota: 0, entries: [] }

export function SZUWallet({ view }: SZUWalletProps) {
  const { t } = useTranslation()
  const [snapshot, setSnapshot] = useState<QuotaSnapshot>(EMPTY_SNAPSHOT)
  const [loading, setLoading] = useState(true)

  const refreshQuota = useCallback(async () => {
    setLoading(true)
    try {
      const [userResponse, ledgerResponse] = await Promise.all([
        getSelf(),
        api.get('/api/user/self/quota-ledger', {
          params: { p: 1, page_size: 100 },
        }),
      ])
      const user = userResponse.success
        ? (userResponse.data as UserWalletData | undefined)
        : undefined
      const ledger = ledgerResponse.data
      if (!user || !ledger?.success) {
        throw new Error('quota response failed')
      }
      setSnapshot({
        availableQuota: Math.max(0, Number(user.quota ?? 0)),
        entries: (ledger.data?.items ?? []) as QuotaLedgerEntry[],
      })
    } catch {
      toast.error(t('Failed to load quota information'))
      setSnapshot(EMPTY_SNAPSHOT)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refreshQuota()
  }, [refreshQuota])

  return view === 'redeem' ? (
    <RedemptionView onRedeemed={refreshQuota} />
  ) : (
    <BillingView loading={loading} snapshot={snapshot} />
  )
}

function RedemptionView({ onRedeemed }: { onRedeemed: () => Promise<void> }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const { redeeming, redeemCode } = useRedemption()

  const handleRedeem = useCallback(async () => {
    const success = await redeemCode(code)
    if (!success) return
    setCode('')
    await onRedeemed()
  }, [code, onRedeemed, redeemCode])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Redeem Code')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-3xl space-y-4'>
          <Alert className='border-primary/20 bg-primary/5 px-4 py-3'>
            <Gift />
            <AlertTitle>{t('Redemption Quota')}</AlertTitle>
            <AlertDescription>
              {t(
                'Redemption codes add quota points directly to your available account balance.'
              )}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <div className='flex items-center gap-3'>
                <div className='bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg'>
                  <TicketCheck className='size-5' />
                </div>
                <div>
                  <CardTitle>{t('Redemption Code')}</CardTitle>
                  <CardDescription>
                    {t('Please enter a redemption code')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className='flex flex-col gap-3 sm:flex-row'>
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !redeeming) {
                      void handleRedeem()
                    }
                  }}
                  placeholder={t('Please enter a redemption code')}
                  autoComplete='off'
                  className='h-10 flex-1 font-mono'
                />
                <Button
                  onClick={() => void handleRedeem()}
                  disabled={redeeming || code.trim() === ''}
                  className='h-10 sm:min-w-28'
                >
                  {redeeming && <Loader2 className='animate-spin' />}
                  {t('Redeem')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function BillingView({
  loading,
  snapshot,
}: {
  loading: boolean
  snapshot: QuotaSnapshot
}) {
  const { t } = useTranslation()
  const income = useMemo(() => {
    return snapshot.entries.reduce(
      (summary, entry) => {
        summary[entry.source] += entry.amount
        return summary
      },
      { monthly: 0, redemption: 0 }
    )
  }, [snapshot.entries])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Quota Billing')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <Alert className='border-primary/20 bg-primary/5 px-4 py-3'>
            <CircleGauge />
            <AlertTitle>{t('Unified Available Quota')}</AlertTitle>
            <AlertDescription>
              {t(
                'Monthly free quota and redemption quota enter the same balance. Unused quota is never cleared and rolls over automatically.'
              )}
            </AlertDescription>
          </Alert>

          {loading ? (
            <Skeleton className='h-36 rounded-xl' />
          ) : (
            <Card>
              <CardHeader>
                <CardDescription>
                  {t('Current Available Quota')}
                </CardDescription>
                <CardTitle className='text-3xl tabular-nums'>
                  {formatNumber(snapshot.availableQuota)}{' '}
                  <span className='text-muted-foreground text-sm font-normal'>
                    {t('Quota Points')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-muted-foreground text-sm'>
                  {t(
                    'There is no separate monthly balance or redemption balance.'
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className='grid gap-4 sm:grid-cols-2'>
            <IncomeCard
              title={t('Monthly Free Quota Income')}
              value={income.monthly}
            />
            <IncomeCard
              title={t('Redemption Code Income')}
              value={income.redemption}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('Quota Income Ledger')}</CardTitle>
              <CardDescription>
                {t(
                  'The ledger contains only monthly free grants and redemption code credits.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='space-y-2'>
                  <Skeleton className='h-10 w-full' />
                  <Skeleton className='h-10 w-full' />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Time')}</TableHead>
                      <TableHead>{t('Source')}</TableHead>
                      <TableHead>{t('Description')}</TableHead>
                      <TableHead className='text-right'>
                        {t('Quota Income')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.entries.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className='text-muted-foreground h-24 text-center'
                        >
                          {t('No quota income records')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      snapshot.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {formatTimestamp(entry.created_at)}
                          </TableCell>
                          <TableCell>
                            {entry.source === 'monthly'
                              ? t('Monthly Free Quota')
                              : t('Redemption Code')}
                          </TableCell>
                          <TableCell>{entry.description || '-'}</TableCell>
                          <TableCell className='text-right font-medium tabular-nums'>
                            +{formatNumber(entry.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function IncomeCard({ title, value }: { title: string; value: number }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className='text-2xl tabular-nums'>
          +{formatNumber(value)}{' '}
          <span className='text-muted-foreground text-xs font-normal'>
            {t('Quota Points')}
          </span>
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
