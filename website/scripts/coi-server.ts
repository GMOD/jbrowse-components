// The jbrowse-web build served with the COOP/COEP headers that make
// `crossOriginIsolated` true, and therefore SharedArrayBuffer available.
//
// Deliberately not `createTestServer` from browser-test-utils: coi-probe.ts and
// cancel-bench.ts exist to measure what these headers change, so the header set
// is their subject rather than their scaffolding, and both need to run with it
// off as well as on. They had a copy each, differing only in whether
// `--credentialless` was reachable and whether `/extra_test_data/` routed
// anywhere — neither difference was deliberate.
import http from 'node:http'
import path from 'node:path'

import handler from 'serve-handler'

import { repoRoot } from './paths.ts'

const webRoot = path.join(repoRoot, 'products', 'jbrowse-web')
const buildPath = path.join(webRoot, 'build')

export function serveCoi({
  port,
  coi,
  credentialless = false,
}: {
  port: number
  // false serves the same tree with no isolation headers — the control arm
  coi: boolean
  // `credentialless` lets a no-CORP subresource load; `require-corp` doesn't.
  // Only matters when a run turns up a resource the strict policy blocks.
  credentialless?: boolean
}): Promise<http.Server> {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      if (coi) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader(
          'Cross-Origin-Embedder-Policy',
          credentialless ? 'credentialless' : 'require-corp',
        )
        // on every response, so same-origin subresources survive require-corp
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      }
      res.setHeader('Access-Control-Allow-Origin', '*')
      const url = req.url ?? '/'
      const pub = url.startsWith('/extra_test_data/')
        ? repoRoot
        : url.startsWith('/test_data/')
          ? webRoot
          : buildPath
      void handler(req, res, { public: pub })
    })
    server.listen(port, () => {
      resolve(server)
    })
  })
}
