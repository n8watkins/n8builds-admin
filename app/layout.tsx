import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

// Inter, bundled like n8builds-web (variable weight, Latin subset; OFL, see app/fonts/Inter-OFL.txt).
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', 'arial'],
})

export const metadata: Metadata = {
  title: { default: 'Admin | n8builds', template: '%s | n8builds admin' },
  description: 'Private owner dashboard for n8builds.dev.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
}

export const viewport: Viewport = {
  themeColor: '#050812',
  colorScheme: 'dark',
}

// No analytics, no Speed Insights, no third-party scripts: this app only reads.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  )
}
