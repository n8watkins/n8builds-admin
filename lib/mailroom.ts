import 'server-only'
import { mailroomAdmin } from './db'
import { formatNumber } from './format'
import type { Fetched } from './github'

/**
 * Email across every app, from mailroom (github.com/n8watkins/mailroom), the
 * one Worker that sends every app's email through Cloudflare Email Service,
 * over the MAILROOM service binding to its MailroomAdmin entrypoint (never a
 * public URL). Its monthly counts come from the Email Sending event
 * subscription on n8builds.dev, so apps that still send with their own
 * binding are counted too. Addresses arrive masked; no email content exists.
 */

/** mailroom's usage() answer (its src/types.ts, Usage). */
export type EmailUsage = {
  generatedAt: string
  monthStart: string
  eventsSince: number | null
  globalToday: number
  globalDayCap: number
  priorityReserve: number
  /**
   * mailroom's all-app monthly cap (a rolling 32 UTC days), its hard limit
   * under the plan's included emails. Missing from a Worker older than it.
   */
  globalMonth?: GlobalMonth
  /** When today's all-app daily cap was reached and alerted (epoch ms), or null. */
  globalDayCappedAt?: number | null
  monthlyIncluded: number
  accountMonth: number
  otherSenders: { sender: string; sentMonth: number }[]
  suppressions: number
  apps: AppUsage[]
}

export type GlobalMonth = {
  /** Sends counted in the window. */
  used: number
  cap: number
  /** The last part of `cap` only sign-in links may use. */
  priorityReserve: number
  /** The first day the window counts (UTC, YYYY-MM-DD). */
  windowStart: string
  windowDays: number
  /** `used` at or past this (70% of `cap`) needs attention. */
  warnAt: number
  attention: boolean
  /** When use first crossed `warnAt` (epoch ms), while `attention` holds. */
  attentionSince: number | null
  /** The thresholds (70, 85, 95, 100 percent) already alerted in this window, and when. */
  alerts: { threshold: number; at: number }[]
}

export type AppUsage = {
  app: string
  today: number
  month: number
  sentMonth: number
  caps: { day: number; month: number; recipientDay: number }
  defaultDayCap: number
  paused: boolean
  bounces30d: number
  complaints30d: number
  failed30d: number
}

export type SendRow = { id: number; at: number; app: string; kind: string; recipient: string; status: string; error: string | null }
export type ProblemRow = { eventId: string; at: number; app: string | null; type: string; recipient: string | null; bounceType: string | null; smtpStatus: string | null; reason: string | null }
export type SuppressionRow = { id: number; recipient: string; reason: string; app: string | null; createdAt: number }
export type AuditRow = { id: number; at: number; actor: string; action: string; app: string | null; detail: string }
export type ActionResult = { ok: true; detail: string } | { ok: false; error: string }

/** mailroom's MailroomAdmin entrypoint (its src/index.ts). */
export type MailroomAdmin = {
  usage(): Promise<EmailUsage>
  recentSends(opts?: { limit?: number; app?: string }): Promise<SendRow[]>
  problems(opts?: { limit?: number }): Promise<ProblemRow[]>
  suppressions(opts?: { limit?: number }): Promise<SuppressionRow[]>
  auditLog(opts?: { limit?: number }): Promise<AuditRow[]>
  removeSuppression(id: number, actor: string): Promise<ActionResult>
  setPaused(app: string, paused: boolean, actor: string): Promise<ActionResult>
  setDailyCap(app: string, cap: number | null, actor: string): Promise<ActionResult>
}

/** mailroom's app ids, as people say them. */
const APP_NAMES: Record<string, string> = {
  prpost: 'PR Post',
  cutelyaskme: 'Cutely Ask Me',
  'n8builds-web': 'n8builds.dev',
  nettrailers: 'Net Trailers',
  wren: 'Wren',
  keysready: 'KeysReady',
  portfoliorank: 'Portfolio Rank',
  openping: 'OpenPing',
  'openping-hosted': 'OpenPing Hosted',
}

export const appName = (id: string | null) => (id ? (APP_NAMES[id] ?? id) : 'Unknown app')

/** Where meters turn amber, as a share of a limit (red at 100%). */
export const WARN_SHARE = 0.7

/** This month's emails per app, busiest first, then senders no app owns. Apps with none are left out. */
export function monthRows(usage: EmailUsage): { label: string; value: number }[] {
  const apps = usage.apps.filter((a) => a.sentMonth > 0).map((a) => ({ label: appName(a.app), value: a.sentMonth }))
  const others = usage.otherSenders.map((o) => ({ label: o.sender, value: o.sentMonth }))
  return [...apps.sort((a, b) => b.value - a.value), ...others]
}

/** "150 (6%)": a count and its share of a total, "<1%" for a small one that isn't zero. */
export function withShare(value: number, total: number): string {
  if (total <= 0) return formatNumber(value)
  const percent = (value / total) * 100
  return `${formatNumber(value)} (${value > 0 && percent < 0.5 ? '<1' : Math.round(percent)}%)`
}

/**
 * The apps' monthly slices against the all-app cap: what they add up to, what
 * they sent this month, and the part of the cap no app has (negative when the
 * slices add up to more). `left` is null without the cap (an older Worker).
 */
export function sliceTotals(usage: Pick<EmailUsage, 'apps' | 'globalMonth'>): { slices: number; used: number; left: number | null } {
  const slices = usage.apps.reduce((sum, a) => sum + a.caps.month, 0)
  const used = usage.apps.reduce((sum, a) => sum + a.month, 0)
  return { slices, used, left: usage.globalMonth ? usage.globalMonth.cap - slices : null }
}

async function read<T>(load: (admin: MailroomAdmin) => Promise<T>): Promise<Fetched<T> | null> {
  const admin = await mailroomAdmin()
  if (!admin) return null
  try {
    return { ok: true, data: await load(admin) }
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : 'mailroom did not answer' }
  }
}

/** Null where the MAILROOM binding isn't there (a local server without mailroom running). */
export const getEmailUsage = () => read((admin) => admin.usage())
export const getRecentSends = (limit = 50) => read((admin) => admin.recentSends({ limit }))
export const getProblems = (limit = 50) => read((admin) => admin.problems({ limit }))
export const getSuppressions = (limit = 100) => read((admin) => admin.suppressions({ limit }))
export const getAuditLog = (limit = 30) => read((admin) => admin.auditLog({ limit }))
