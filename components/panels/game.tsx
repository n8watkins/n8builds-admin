import { formatNumber } from '@/lib/format'
import { readGameStats, type GameSite, type HighScore } from '@/lib/game'
import { isStoreConnected } from '@/lib/store'
import { Sparkline } from '../Sparkline'
import { BarList, NotConnected, PanelError, Stat, errorMessage } from '../ui'

// ---------------------------------------------------------------------------
// The dino catch game, on n8builds.dev and the portfolio

const STORE_VARS = ['ANALYTICS_REDIS_REST_URL', 'ANALYTICS_REDIS_REST_TOKEN']
const code = 'rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[13px] text-slate-200'

const GAME_PLAN = [
  <>The dino in the AI kit (n8builds.dev) and the tech stack card (portfolio.n8builds.dev) sends a round&apos;s start and its score to n8builds.dev&apos;s <code className={code}>/api/game</code>.</>,
  <>That route takes only the two sites, rate limits each player, and counts a score only for a round started at least 29 seconds earlier, capped at 60.</>,
  'A player is a hash of IP and browser with a salt that changes every day and is deleted after two days: no IP, user agent or cookie is ever stored.',
  <>Set the same two variables on the <strong>n8builds-web</strong> project too: that is where the counts are written.</>,
]

const SITE_LABEL: Record<GameSite, string> = { n8builds: 'n8builds.dev', portfolio: 'portfolio' }

/** A country code as its name ("US" -> "United States"); unknown stays a code. */
function country(code: string): string {
  if (code === 'XX') return 'Unknown'
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

function HighScores({ rows }: { rows: HighScore[] }) {
  return (
    <table className="w-full text-left text-[15px]">
      <thead className="text-[13px] text-slate-400">
        <tr>
          <th className="py-1.5 pr-3 font-normal">#</th>
          <th className="py-1.5 pr-3 font-normal">Score</th>
          <th className="py-1.5 pr-3 font-normal">Site</th>
          <th className="py-1.5 pr-3 font-normal">Country</th>
          <th className="py-1.5 font-normal">Date</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((row, index) => (
          <tr key={`${row.score}-${row.date}-${index}`} className="border-t border-white/[0.06]">
            <td className="py-1.5 pr-3 text-slate-400">{index + 1}</td>
            <td className="py-1.5 pr-3 font-semibold text-slate-50">{row.score}</td>
            <td className="py-1.5 pr-3 text-slate-200">{SITE_LABEL[row.site]}</td>
            <td className="py-1.5 pr-3 text-slate-200">{country(row.country)}</td>
            <td className="py-1.5 text-slate-300">{row.date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export async function GamePanel() {
  if (!isStoreConnected()) {
    return (
      <NotConnected
        why="Counting the game's rounds ourselves keeps it private: no cookies, no consent banner, and no data sent to anyone else."
        willShow={['Rounds started and finished', 'Players per day, per site', 'High scores with site, country and date', 'Scores and countries']}
        needs={STORE_VARS}
        plan={GAME_PLAN}
        setupId="upstash"
      />
    )
  }
  let stats
  try {
    stats = await readGameStats(30)
  } catch (error) {
    return <PanelError message={errorMessage(error)} />
  }
  if (stats.started === 0) {
    return <NotConnected title="No rounds yet" why="The analytics database is connected; the first round played on either site will show here." plan={GAME_PLAN} />
  }
  const today = stats.days.at(-1)!
  const best = stats.top[0]
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat label="Rounds, 30 days" value={formatNumber(stats.started)} hint={`${formatNumber(stats.finished)} played to the end`} />
        <Stat label="Players today" value={formatNumber(today.players)} hint={`${formatNumber(stats.playerDays)} player-days in 30 days`} />
        <Stat label="Tries per player" value={stats.attemptsPerPlayer.toFixed(1)} hint={`a day on average; most ${stats.mostAttempts}`} />
        <Stat label="High score" value={best ? formatNumber(best.score) : '0'} hint={best ? `${SITE_LABEL[best.site]}, ${country(best.country)}, ${best.date}` : undefined} />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[14px] text-slate-400">Rounds per day, last 30 days</p>
          <Sparkline values={stats.days.map((day) => day.started)} label="Dino game rounds per day, last 30 days" />
        </div>
        <div>
          <p className="mb-2 text-[14px] text-slate-400">Players per day, last 30 days</p>
          <Sparkline values={stats.days.map((day) => day.players)} label="Dino game players per day, last 30 days" color="var(--color-lime-400)" />
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[14px] text-slate-400">By site, 30 days</p>
          <BarList
            rows={(['n8builds', 'portfolio'] as const).map((site) => ({
              label: `${SITE_LABEL[site]}: best ${stats.bestBySite[site]?.score ?? 0}, ${formatNumber(stats.playersBySite[site])} player-days`,
              value: stats.startedBySite[site],
            }))}
            format={(value) => `${formatNumber(value)} rounds`}
          />
        </div>
        <div>
          <p className="mb-2 text-[14px] text-slate-400">Scores of finished rounds</p>
          <BarList rows={stats.scoreBuckets} format={formatNumber} />
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[14px] text-slate-400">High scores, all time</p>
          {stats.top.length ? <HighScores rows={stats.top} /> : <p className="text-[14px] text-slate-400">No finished rounds with a catch yet.</p>}
        </div>
        <div>
          <p className="mb-2 text-[14px] text-slate-400">Where players are, by rounds (30 days)</p>
          <BarList rows={stats.countries.slice(0, 10).map((row) => ({ label: country(row.label), value: row.value }))} format={formatNumber} />
        </div>
      </div>
    </div>
  )
}
