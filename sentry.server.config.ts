import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  beforeSend(event) {
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
