import Image, { type StaticImageData } from 'next/image'
import n8builds from '@/assets/projects/n8builds-web.png'
import openPing from '@/assets/projects/open-ping.svg'
import piperTts from '@/assets/projects/piper-tts.png'
import portfolioRank from '@/assets/projects/portfolio-rank.png'
import scribe from '@/assets/projects/scribe.png'
import solara from '@/assets/projects/solara.png'
import tlDw from '@/assets/projects/tl-dw.png'
import tubeVault from '@/assets/projects/tube-vault.png'
import { cx } from './ui'

/** Each build's real icon, from n8builds-web's public/builds (the portfolio shares the N8 mark). */
const ICONS: Record<string, StaticImageData> = {
  'n8watkins/n8builds-web': n8builds,
  'n8watkins/dev-portfolio': n8builds,
  'n8watkins/open-ping': openPing,
  'n8watkins/piper-tts': piperTts,
  'n8watkins/portfolio-rank': portfolioRank,
  'n8watkins/scribe': scribe,
  'n8watkins/solara': solara,
  'n8watkins/tl-dw': tlDw,
  'n8watkins/tube-vault': tubeVault,
}

export function ProjectIcon({ repo, size = 32, className }: { repo: string; size?: number; className?: string }) {
  const icon = ICONS[repo]
  if (!icon) return <span aria-hidden className={cx('inline-block shrink-0 rounded-lg bg-white/10', className)} style={{ width: size, height: size }} />
  return <Image src={icon} alt="" width={size} height={size} className={cx('shrink-0 rounded-lg', className)} />
}
