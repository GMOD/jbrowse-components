import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

import handler from 'serve-handler'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const buildPath = path.resolve(__dirname, '../build')
export const testDataPath = path.resolve(__dirname, '..')
export const extraTestDataPath = path.resolve(__dirname, '../../..', 'extra_test_data')

export function startServer(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url || '/'
      let publicPath: string
      if (url.startsWith('/test_data/')) {
        publicPath = testDataPath
      } else if (url.startsWith('/extra_test_data/')) {
        publicPath = path.resolve(testDataPath, '../..')
      } else {
        publicPath = buildPath
      }
      return handler(req, res, {
        public: publicPath,
        headers: [
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
