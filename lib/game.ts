import 'server-only'
import { lastDays, store } from './store'

/**
 * The dino catch game's stats, written by n8builds-web's /api/game (its
 * lib/game/stats.ts lists the keys) from n8builds.dev and the portfolio.
 * Aggregates only: daily counters, HyperLogLog player counts, and the top
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

/** Parses the top-scores sorted set ([member, score, member, score, ...]). */
export function parseTop(flat: (string | number)[]): HighScore[] {
  const out: HighScore[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const [site, country, date] = String(flat[i]).split('|')
    if (site !== 'n8builds' && site !== 'portfolio') continue
    out.push({ score: num(flat[i + 1]), site, country: country || 'XX', date: date ?? '' })
  }
  return out
}

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

/** Reads the last `days` of the game's stats in one round trip, plus the top scores. */
export async function readGameStats(days = 30): Promise<GameStats> {
  const dates = lastDays(days)
  const pipeline = store().pipeline()
  for (const date of dates) {
    pipeline.hgetall(`game:rounds:${date}`)
    pipeline.pfcount(`game:players:${date}`)
    for (const site of GAME_SITES) pipeline.pfcount(`game:players:${date}:${site}`)
    pipeline.hgetall(`game:attempts:${date}`)
    pipeline.hgetall(`game:scores:${date}`)
    pipeline.hgetall(`game:countries:${date}`)
  }
  const [firstDay, ...otherDays] = dates.map((date) => `game:players:${date}`)
  pipeline.pfcount(firstDay, ...otherDays)
  pipeline.zrange('game:top', 0, 9, { rev: true, withScores: true })
  const results = (await pipeline.exec()) as unknown[]
  // Per day: rounds, players, players per site, attempts, scores, countries.
  const per = 5 + GAME_SITES.length
  const raw: GameDayRaw[] = dates.map((date, index) => {
    const r = results.slice(index * per, index * per + per)
    return {
      date,
      rounds: r[0] as GameDayRaw['rounds'],
      players: num(r[1]),
      playersBySite: { n8builds: num(r[2]), portfolio: num(r[3]) },
      attempts: r[2 + GAME_SITES.length] as GameDayRaw['attempts'],
      scores: r[3 + GAME_SITES.length] as GameDayRaw['scores'],
      countries: r[4 + GAME_SITES.length] as GameDayRaw['countries'],
    }
  })
  const playerDays = num(results[dates.length * per])
  const top = parseTop((results[dates.length * per + 1] as (string | number)[]) ?? [])
  return summarizeGame(raw, top, playerDays)
}
