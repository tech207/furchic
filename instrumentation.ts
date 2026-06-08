// Sentry is initialized via sentry.server.config.ts / sentry.edge.config.ts
// which are loaded automatically by @sentry/nextjs withSentryConfig webpack plugin.
// After running: npm install @sentry/nextjs
// Uncomment the block below and update next.config.mjs per DEPLOYMENT.md section 7.

export async function register() {
  // if (process.env.NEXT_RUNTIME === 'nodejs') {
  //   await import('./sentry.server.config')
  // }
  // if (process.env.NEXT_RUNTIME === 'edge') {
  //   await import('./sentry.edge.config')
  // }
}
