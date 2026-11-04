import 'server-only'
import { analyticsDb } from './db'
import { lastDays } from './store'

/**
 * The dino catch game's stats, written by n8builds-web's /api/game (its
 * lib/game/stats.ts lists the tables) from n8builds.dev and the portfolio,
 * into n8builds-analytics, which this dashboard only reads.
 * Aggregates only: daily counters, salted daily player hashes, and the top
 * scores with site, country and date. No IPs, no cookies.
 */

export const GAME_SITES = ['n8builds', 'portfolio'] as const
export type GameSite = (typeof GAME_SITES)[number]

export type GameDayRaw = {
  date: string
  rounds: Record<string, number | string> | null
  players: number
  playersBySite: Record<GameSite, number>
  attempts: Record<string, number | string> | null
  scores: Record<string, number | string> | null
  countries: Record<string, number | string> | null
}

export type HighScore = { score: number; site: GameSite; country: string; date: string }

export type GameStats = {
  days: { date: string; started: number; finished: number; players: number }[]
  started: number
  finished: number
  /** Distinct daily players over the period (the id changes daily, so a returning player counts once a day). */
  playerDays: number
  playersBySite: Record<GameSite, number>
  startedBySite: Record<GameSite, number>
  /** Rounds started per player per day, on average, and the most anyone tried in a day. */
  attemptsPerPlayer: number
  mostAttempts: number
  scoreBuckets: { label: string; value: number }[]
  countries: { label: string; value: number }[]
  top: HighScore[]
  bestBySite: Partial<Record<GameSite, HighScore>>
}

const num = (value: unknown) => Number(value) || 0
const BUCKETS: [string, number, number][] = [
  ['0', 0, 0],
  ['1 to 4', 1, 4],
  ['5 to 9', 5, 9],
  ['10 to 14', 10, 14],
  ['15 to 19', 15, 19],
  ['20 to 29', 20, 29],
  ['30 or more', 30, Infinity],
]

/** Turns the raw daily reads into the panel's numbers (pure, so it is unit-tested). */
export function summarizeGame(raw: GameDayRaw[], top: HighScore[], playerDays: number): GameStats {
  const startedBySite = { n8builds: 0, portfolio: 0 } as Record<GameSite, number>
  const playersBySite = { n8builds: 0, portfolio: 0 } as Record<GameSite, number>
  const scores = new Map<number, number>()
  const countries = new Map<string, number>()
  let attempts = 0
  let attemptPlayers = 0
  let mostAttempts = 0
  const days = raw.map((day) => {
    let started = 0
    let finished = 0
    for (const [field, value] of Object.entries(day.rounds ?? {})) {
      const [kind, site] = field.split(':') as ['start' | 'end', GameSite]
      if (kind === 'start') {
        started += num(value)
        if (site in startedBySite) startedBySite[site] += num(value)
      } else if (kind === 'end') finished += num(value)
    }
    for (const site of GAME_SITES) playersBySite[site] += day.playersBySite[site]
    for (const value of Object.values(day.attempts ?? {})) {
      attempts += num(value)
      attemptPlayers += 1
      mostAttempts = Math.max(mostAttempts, num(value))
    }
    for (const [score, count] of Object.entries(day.scores ?? {})) scores.set(num(score), (scores.get(num(score)) ?? 0) + num(count))
    for (const [country, count] of Object.entries(day.countries ?? {})) countries.set(country, (countries.get(country) ?? 0) + num(count))
    return { date: day.date, started, finished, players: day.players }
  })
  const bestBySite: Partial<Record<GameSite, HighScore>> = {}
  for (const entry of top) if (!bestBySite[entry.site] || entry.score > bestBySite[entry.site]!.score) bestBySite[entry.site] = entry
  return {
    days,
    started: days.reduce((sum, day) => sum + day.started, 0),
    finished: days.reduce((sum, day) => sum + day.finished, 0),
    playerDays,
    playersBySite,
    startedBySite,
    attemptsPerPlayer: attemptPlayers ? attempts / attemptPlayers : 0,
    mostAttempts,
    scoreBuckets: BUCKETS.map(([label, lo, hi]) => ({
      label,
      value: [...scores.entries()].filter(([score]) => score >= lo && score <= hi).reduce((sum, [, count]) => sum + count, 0),
    })),
    countries: [...countries.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
    top: [...top].sort((a, b) => b.score - a.score),
    bestBySite,
  }
}

const isSite = (site: string): site is GameSite => (GAME_SITES as readonly string[]).includes(site)

/** Reads the last `days` of the game's stats, plus the all-time top scores. */
export async function readGameStats(days = 30, now = new Date()): Promise<GameStats> {
  const db = await analyticsDb()
  if (!db) throw new Error('The analytics database is not connected')
  const dates = lastDays(days, now)
  const from = dates[0]
  const [counters, players, attempts, playerDays, top] = await Promise.all([
    db.all<{ metric: string; day: string; field: string; count: number }>(
      "SELECT metric, day, field, count FROM analytics_daily WHERE metric IN ('game:rounds', 'game:scores', 'game:countries') AND day >= ?",
      from
    ),
    db.all<{ day: string; site: string; players: number }>('SELECT day, site, COUNT(*) AS players FROM game_players WHERE day >= ? GROUP BY day, site', from),
    db.all<{ day: string; player: string; rounds: number }>('SELECT day, player, SUM(rounds) AS rounds FROM game_players WHERE day >= ? GROUP BY day, player', from),
    db.first<{ n: number }>('SELECT COUNT(*) AS n FROM (SELECT DISTINCT day, player FROM game_players WHERE day >= ?)', from),
    db.all<{ score: number; site: string; country: string; day: string }>(
      'SELECT score, site, country, day FROM game_top ORDER BY score DESC, round_id DESC LIMIT 10'
    ),
  ])
  const hash = (metric: string, date: string) => {
    const rows = counters.filter((row) => row.metric === metric && row.day === date)
    return rows.length ? Object.fromEntries(rows.map((row) => [row.field, row.count])) : null
  }
  const raw: GameDayRaw[] = dates.map((date) => {
    const bySite = { n8builds: 0, portfolio: 0 } as Record<GameSite, number>
    for (const row of players) if (row.day === date && isSite(row.site)) bySite[row.site] = row.players
    const dayAttempts = attempts.filter((row) => row.day === date)
    return {
      date,
      rounds: hash('game:rounds', date),
      // A player is counted once a day, whichever sites they played on.
      players: dayAttempts.length,
      playersBySite: bySite,
      attempts: dayAttempts.length ? Object.fromEntries(dayAttempts.map((row) => [row.player, row.rounds])) : null,
      scores: hash('game:scores', date),
      countries: hash('game:countries', date),
    }
  })
  const highScores: HighScore[] = top.flatMap((row) => (isSite(row.site) ? [{ score: row.score, site: row.site, country: row.country || 'XX', date: row.day }] : []))
  return summarizeGame(raw, highScores, num(playerDays?.n))
}
