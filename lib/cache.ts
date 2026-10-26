/** Every upstream read is cached for five minutes (Next.js data cache), so a reload never hammers an API. */
export const REVALIDATE_SECONDS = 300
