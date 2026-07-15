/* eslint-disable no-console */
import { startOAuthServer } from '../servers.ts'

// Standalone manual-run OAuth test server (port 3030), for local development.
// The redirect-uri is http://localhost:3000, so run jbrowse-web on that port
// (the default dev server port). The runner starts the same server
// programmatically via startOAuthServer — this is just a CLI entrypoint.
console.log(
  'The redirect-uri is http://localhost:3000 — run jbrowse-web there (default dev server port)',
)
startOAuthServer({ port: 3030, redirectPort: 3000 }).catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
