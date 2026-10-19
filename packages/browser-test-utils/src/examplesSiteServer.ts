import http from 'node:http'

import handler from 'serve-handler'

/**
 * Serve an examples-site's built `dist/` on a free port, under its Astro
 * `base`, so `/storybook/<x>/foo/` resolves to `dist/foo/`.
 */
export async function serveExamplesSite(distDir: string, base: string) {
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith(base)) {
      req.url = req.url.slice(base.length) || '/'
    }
    void handler(req, res, { public: distDir })
  })
  await new Promise<void>(resolve => {
    server.listen(0, resolve)
  })
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  return {
    url: (slug = '') =>
      `http://localhost:${port}${base}/${slug ? `${slug}/` : ''}`,
    close: () =>
      new Promise<void>(resolve => {
        server.close(() => {
          resolve()
        })
      }),
  }
}
