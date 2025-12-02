import http from 'http'

import handler from 'serve-handler'

export interface ServerOptions {
  port: number
  publicPath: string
  headers?: { source: string; headers: { key: string; value: string }[] }[]
}

export function startServer(options: ServerOptions): Promise<http.Server> {
  const { port, publicPath, headers } = options
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      return handler(req, res, {
        public: publicPath,
        headers: headers ?? [
          {
            source: '**/*',
            headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
          },
        ],
      })
    })
    server.on('error', reject)
    server.listen(port, () => {
      resolve(server)
    })
  })
}
