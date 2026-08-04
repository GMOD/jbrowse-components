import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createTestServer } from '@jbrowse/browser-test-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const jbrowseWebRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(__dirname, '../../..')
export const buildPath = path.join(jbrowseWebRoot, 'build')

export function startServer(port: number) {
  return createTestServer(port, { jbrowseWebRoot, repoRoot })
}

/**
 * Start the test server on `preferred`, or the next free port after it.
 *
 * The default is a fixed number, and in a worktree shared by several agents it
 * is regularly held by someone else's run or a dev server — which used to abort
 * the whole suite on EADDRINUSE before a single test ran. Walking up costs
 * nothing when the port is free and turns "someone else is testing" from a hard
 * stop into a different number in the url.
 *
 * The caller must publish the port it gets back (see setPort in helpers), since
 * every url the suites build is relative to it.
 */
export async function startServerOnFreePort(preferred: number, attempts = 20) {
  for (let port = preferred; port < preferred + attempts; port++) {
    try {
      return { server: await startServer(port), port }
    } catch (e) {
      // compare the code, never instanceof: this rejects with whatever node's
      // net module threw, which may come from another realm
      if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
        throw e
      }
    }
  }
  throw new Error(
    `no free port in ${preferred}..${preferred + attempts - 1} for the test server`,
  )
}
