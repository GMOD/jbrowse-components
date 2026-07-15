import { startBasicAuthServer } from '../servers.ts'

// Standalone manual-run HTTP Basic Auth test server (port 3040), for local
// development against the jbrowse-web dev server. The runner starts the very
// same server programmatically via startBasicAuthServer — this is just a CLI
// entrypoint so the two never drift (it serves /data with admin/password plus
// the path-scoped /data/public and /data/private credentials).
startBasicAuthServer({ port: 3040 }).catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
