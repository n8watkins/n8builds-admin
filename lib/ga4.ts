import 'server-only'
import { SignJWT, importPKCS8 } from 'jose'
import { unstable_cache } from 'next/cache'
import { REVALIDATE_SECONDS } from './cache'

/**
 * Traffic from the Google Analytics 4 Data API, read by a service account
 * with Viewer access on the property. Written against the API docs; it
 * switches on once the three variables are set (docs/SETUP.md).
 */
export function ga4Config() {
  const propertyId = process.env.GA4_PROPERTY_ID
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL
  // Vercel and .env files keep the key's newlines as literal "\n".
  const privateKey = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!propertyId || !clientEmail || !privateKey) return null
  return { propertyId, clientEmail, privateKey }
}

async function accessToken(clientEmail: string, privateKey: string): Promise<string> {
  const key = await importPKCS8(privateKey, 'RS256')
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/analytics.readonly' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key)
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Google token exchange answered ${response.status}`)
  return ((await response.json()) as { access_token: string }).access_token
}

export type Ranked = { label: string; value: number }

export type TrafficSummary = {
  visitors: number
  sessions: number
  pageViews: number
  avgSessionSeconds: number
  engagementRate: number
  /** Share of page views that reached 90% scroll (GA's enhanced `scroll` event). */
  scrolledShare: number | null
  countries: Ranked[]
  pages: Ranked[]
  referrers: Ranked[]
}

const RANGE = [{ startDate: '28daysAgo', endDate: 'today' }]

type ReportRow = { dimensionValues?: { value: string }[]; metricValues: { value: string }[] }

function ranked(rows: ReportRow[] | undefined): Ranked[] {
  return (rows ?? []).map((row) => ({ label: row.dimensionValues?.[0]?.value ?? '', value: Number(row.metricValues[0]?.value) || 0 }))
}

async function fetchTraffic(): Promise<TrafficSummary> {
  const config = ga4Config()
  if (!config) throw new Error('Google Analytics is not connected')
  const token = await accessToken(config.clientEmail, config.privateKey)
  const top = (dimension: string, metric: string, limit: number) => ({
    dateRanges: RANGE,
    dimensions: [{ name: dimension }],
    metrics: [{ name: metric }],
    orderBys: [{ metric: { metricName: metric }, desc: true }],
    limit,
  })
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:batchRunReports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          dateRanges: RANGE,
          metrics: ['activeUsers', 'sessions', 'screenPageViews', 'averageSessionDuration', 'engagementRate'].map((name) => ({ name })),
        },
        top('country', 'activeUsers', 6),
        top('pagePath', 'screenPageViews', 8),
        top('sessionSource', 'sessions', 8),
        {
          dateRanges: RANGE,
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: ['page_view', 'scroll'] } } },
        },
      ],
    }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Analytics Data API answered ${response.status}`)
  const { reports } = (await response.json()) as { reports: { rows?: ReportRow[] }[] }
  const totals = reports[0]?.rows?.[0]?.metricValues.map((value) => Number(value.value) || 0) ?? []
  const events = Object.fromEntries(ranked(reports[4]?.rows).map((row) => [row.label, row.value]))
  return {
    visitors: totals[0] ?? 0,
    sessions: totals[1] ?? 0,
    pageViews: totals[2] ?? 0,
    avgSessionSeconds: totals[3] ?? 0,
    engagementRate: totals[4] ?? 0,
    scrolledShare: events.page_view ? (events.scroll ?? 0) / events.page_view : null,
    countries: ranked(reports[1]?.rows),
    pages: ranked(reports[2]?.rows),
    referrers: ranked(reports[3]?.rows),
  }
}

/** POST requests skip the fetch cache, so the whole report is cached here instead. */
export const getTraffic = unstable_cache(fetchTraffic, ['ga4-traffic'], { revalidate: REVALIDATE_SECONDS })
