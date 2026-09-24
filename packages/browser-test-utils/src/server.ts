import http from 'node:http'
import http2 from 'node:http2'
import path from 'node:path'

import handler from 'serve-handler'

const corsHeaders = [
  {
    source: '**/*',
    headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
  },
]

// what the deploy sends for the content-hashed half of a build
const buildHeaders = [
  ...corsHeaders,
  {
    source: 'static/**',
    headers: [
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ],
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

function staticRoot(url: string, jbrowseWebRoot: string, repoRoot: string) {
  return url.startsWith('/test_data/')
    ? { public: jbrowseWebRoot, headers: corsHeaders }
    : url.startsWith('/extra_test_data/')
      ? { public: repoRoot, headers: corsHeaders }
      : undefined
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
      const root = staticRoot(req.url ?? '/', jbrowseWebRoot, repoRoot)
      if (root) {
        void handler(req, res, root)
      } else if (proxyPort !== undefined) {
        proxyToPort(req, res, proxyPort)
      } else {
        void handler(req, res, { public: buildPath, headers: buildHeaders })
      }
    })
    server.on('error', reject)
    server.listen(port, () => {
      resolve(server)
    })
  })
}

/**
 * The same routes over HTTP/2 and TLS, which is how the deploy serves them.
 * Over HTTP/1.1 Chrome opens six connections to a host, so a round of forty
 * chunks the deploy fetches at once queues here instead.
 */
export function createSecureTestServer(
  port: number,
  {
    jbrowseWebRoot,
    repoRoot,
    key,
    cert,
  }: Omit<TestServerOptions, 'proxyPort'> & { key: string; cert: string },
): Promise<http2.Http2SecureServer> {
  const buildPath = path.join(jbrowseWebRoot, 'build')
  return new Promise((resolve, reject) => {
    const server = http2.createSecureServer(
      { key, cert, allowHTTP1: true },
      (req, res) => {
        void handler(
          // serve-handler reads only what the compatibility API keeps
          req as unknown as http.IncomingMessage,
          res as unknown as http.ServerResponse,
          staticRoot(req.url, jbrowseWebRoot, repoRoot) ?? {
            public: buildPath,
            headers: buildHeaders,
          },
        )
      },
    )
    server.on('error', reject)
    server.listen(port, () => {
      resolve(server)
    })
  })
}
