import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { parseTop, summarizeGame } = await import('@/lib/game')

const day = (date: string, extra: Partial<Parameters<typeof summarizeGame>[0][number]> = {}) => ({
  date,
  rounds: null,
  players: 0,
  playersBySite: { n8builds: 0, portfolio: 0 },
  attempts: null,
  scores: null,
  countries: null,
  ...extra,
})

describe('parseTop', () => {
  it('reads "site|country|date|id" members with their scores, skipping anything else', () => {
    expect(parseTop(['portfolio|GB|2026-10-27|ab', 31, 'n8builds|US|2026-10-26|cd', '12', 'junk', 5])).toEqual([
      { score: 31, site: 'portfolio', country: 'GB', date: '2026-10-27' },
      { score: 12, site: 'n8builds', country: 'US', date: '2026-10-26' },
    ])
  })
})

describe('summarizeGame', () => {
  it("adds up rounds, players, tries, scores and countries, and finds each site's best", () => {
    const stats = summarizeGame(
      [
        day('2026-10-26', {
          rounds: { 'start:n8builds': '3', 'end:n8builds': '2', 'start:portfolio': 1 },
          players: 2,
          playersBySite: { n8builds: 1, portfolio: 1 },
          attempts: { aaa: '3', bbb: 1 },
          scores: { '0': 1, '7': '1' },
          countries: { US: 3, GB: '1' },
        }),
        day('2026-10-27', {
          rounds: { 'start:portfolio': 2, 'end:portfolio': 2 },
          players: 1,
          playersBySite: { n8builds: 0, portfolio: 1 },
          attempts: { ccc: 2 },
          scores: { '22': 1, '35': 1 },
          countries: { GB: 2 },
        }),
      ],
      parseTop(['portfolio|GB|2026-10-27|x', 35, 'n8builds|US|2026-10-26|y', 7]),
      3
    )
    expect(stats.started).toBe(6)
    expect(stats.finished).toBe(4)
    expect(stats.startedBySite).toEqual({ n8builds: 3, portfolio: 3 })
    expect(stats.playersBySite).toEqual({ n8builds: 1, portfolio: 2 })
    expect(stats.playerDays).toBe(3)
    expect(stats.attemptsPerPlayer).toBe(2)
    expect(stats.mostAttempts).toBe(3)
    expect(stats.days.map((d) => d.started)).toEqual([4, 2])
    expect(Object.fromEntries(stats.scoreBuckets.map((b) => [b.label, b.value]))).toMatchObject({ '0': 1, '5 to 9': 1, '20 to 29': 1, '30 or more': 1 })
    // Most rounds first; a tie goes by code.
    expect(stats.countries).toEqual([
      { label: 'GB', value: 3 },
      { label: 'US', value: 3 },
    ])
    expect(stats.bestBySite.portfolio?.score).toBe(35)
    expect(stats.bestBySite.n8builds?.score).toBe(7)
    expect(stats.top[0].score).toBe(35)
  })
})
