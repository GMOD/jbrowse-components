// A static file server that honours Range. That is not optional here: every
// indexed format JBrowse reads (tabix, BAM, bgzip FASTA) fetches byte ranges,
// and a server that ignores the header returns the whole file with a 200 and
// the adapter silently reads garbage. `python3 -m http.server` is such a server.
import fs from 'fs'
import http from 'http'
import path from 'path'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

export function serveStatic(root, port = 0) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0])
    let file = path.join(root, path.normalize(url).replace(/^(\.\.[/\\])+/, ''))
    if (!file.startsWith(path.resolve(root))) {
      res.writeHead(403).end()
      return
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!fs.existsSync(file)) {
      res.writeHead(404).end('not found')
      return
    }

    const size = fs.statSync(file).size
    const type = TYPES[path.extname(file)] || 'application/octet-stream'
    const headers = {
      'content-type': type,
      'accept-ranges': 'bytes',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    }

    const range = req.headers.range
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range)
      if (m) {
        const start = m[1] ? +m[1] : 0
        const end = m[2] ? Math.min(+m[2], size - 1) : size - 1
        if (start >= size || start > end) {
          res.writeHead(416, { 'content-range': `bytes */${size}` }).end()
          return
        }
        res.writeHead(206, {
          ...headers,
          'content-range': `bytes ${start}-${end}/${size}`,
          'content-length': end - start + 1,
        })
        fs.createReadStream(file, { start, end }).pipe(res)
        return
      }
    }

    res.writeHead(200, { ...headers, 'content-length': size })
    if (req.method === 'HEAD') res.end()
    else fs.createReadStream(file).pipe(res)
  })

  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise(r => server.close(r)),
      })
    })
  })
}
