import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],

  beforeSend(event) {
    // Filter out Next.js internal redirects and not-found errors
    const errorMessage = event.exception?.values?.[0]?.value ?? ''
    if (
      errorMessage.includes('NEXT_NOT_FOUND') ||
      errorMessage.includes('NEXT_REDIRECT')
    ) {
      return null
    }
    return event
  },
})
