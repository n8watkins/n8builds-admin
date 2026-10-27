/** The sidebar: the Overview, one detail page per area, and Setup. */
export type NavItem = { href: string; label: string }
export type NavGroup = { title?: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { items: [{ href: '/', label: 'Overview' }] },
  {
    title: 'GitHub',
    items: [
      { href: '/ci', label: 'CI' },
      { href: '/minutes', label: 'Actions minutes' },
      { href: '/repos', label: 'Stars and traffic' },
      { href: '/releases', label: 'Releases and deploys' },
      { href: '/security', label: 'Security alerts' },
    ],
  },
  {
    title: 'Sites',
    items: [
      { href: '/demos', label: 'Live demos' },
      { href: '/errors', label: 'Errors' },
      { href: '/traffic', label: 'Website traffic' },
    ],
  },
  {
    title: 'Counters',
    items: [
      { href: '/referrals', label: 'Referrals to Appturnity' },
      { href: '/contact', label: 'Contact messages' },
    ],
  },
  { items: [{ href: '/setup', label: 'Setup' }] },
]

export const NAV_ITEMS: NavItem[] = NAV.flatMap((group) => group.items)

export function labelFor(pathname: string): string {
  return NAV_ITEMS.find((item) => item.href === pathname)?.label ?? 'Overview'
}
