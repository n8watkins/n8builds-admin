import type { init } from '@sentry/nextjs'

type DataCollection = NonNullable<NonNullable<Parameters<typeof init>[0]>['dataCollection']>

/**
 * What Sentry may collect with an error, for both server runtimes (`next
 * start` in sentry.server.config.ts, the Worker in worker/index.ts): nothing
 * beyond the error itself. Sentry v11 replaced `sendDefaultPii` and
 * `includeLocalVariables` with this option, and its defaults depend on whether
 * it is set, so every category is spelled out. Request headers and cookies
 * carry the session cookie and the cron's Bearer secret, and stack-frame
 * locals can hold API tokens and the session secret.
 */
export const SENTRY_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  urlQueryParams: false,
  httpBodies: [],
  stackFrameVariables: false,
  databaseQueryData: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
}
