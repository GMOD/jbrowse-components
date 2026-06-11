import http from 'http'
import path from 'path'

import handler from 'serve-handler'

const corsHeaders = [
  {
    source: '**/*',
    headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
  },
]

export interface TestServerOptions {
  // products/jbrowse-web: its `build/` is served as the app, and `/test_data/*`
  // requests are served from here (so they resolve to test_data/ within it)
  jbrowseWebRoot: string
  // repo root: `/extra_test_data/*` requests are served from here
  repoRoot: string
  // when set, non-test_data requests proxy to this port (a running dev server)
  // rather than being served from `build/` — lets the screenshot generator run
  // against a live dev server with `--headed`
  proxyPort?: number
}

function proxyToPort(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetPort: number,
) {
  const proxyReq = http.request(
    {
      hostname: 'localhost',
      port: targetPort,
      path: req.url ?? '/',
      method: req.method,
      headers: req.headers,
    },
    proxyRes => {
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers)
      proxyRes.pipe(res, { end: true })
    },
  )
  proxyReq.on('error', err => {
    console.error(`    proxy error: ${err.message}`)
    res.writeHead(502)
    res.end('Bad Gateway')
  })
  req.pipe(proxyReq, { end: true })
}

// Static server shared by the browser-test runner and the screenshot generator.
// `/test_data/*` comes from jbrowse-web, `/extra_test_data/*` from the repo root,
// and everything else from the compiled `build/` (or a proxied dev server).
export function createTestServer(
  port: number,
  { jbrowseWebRoot, repoRoot, proxyPort }: TestServerOptions,
): Promise<http.Server> {
  const buildPath = path.join(jbrowseWebRoot, 'build')
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/'
      if (url.startsWith('/test_data/')) {
        return handler(req, res, {
          public: jbrowseWebRoot,
          headers: corsHeaders,
        })
      } else if (url.startsWith('/extra_test_data/')) {
        return handler(req, res, { public: repoRoot, headers: corsHeaders })
      } else if (proxyPort !== undefined) {
        return proxyToPort(req, res, proxyPort)
      } else {
        return handler(req, res, { public: buildPath, headers: corsHeaders })
      }
    })
    server.on('error', reject)
    server.listen(port, () => {
      resolve(server)
    })
  })
}
