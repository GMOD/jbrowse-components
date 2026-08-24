import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import handler from 'serve-handler'

import {
  debug,
  isRecord,
  resolveConfigPath,
  writeJsonFile,
} from '../../utils.ts'
import { createDefaultConfig } from '../add-assembly/utils.ts'

import type http from 'node:http'

interface ServerRef {
  current: http.Server | null
}

export function parsePort({
  portStr,
  defaultPort = 9090,
}: {
  portStr: string | undefined
  defaultPort?: number
}): number {
  if (!portStr) {
    return defaultPort
  }

  const parsedPort = Number.parseInt(portStr, 10)
  if (!(parsedPort > 0 && parsedPort <= 65535)) {
    throw new Error(`${portStr} is not a valid port`)
  }

  return parsedPort
}

export function generateKey(): string {
  return crypto.randomBytes(16).toString('hex')
}

export async function setupConfigFile({
  root = '.',
}: {
  root?: string
} = {}): Promise<{ outFile: string; baseDir: string }> {
  const outFile = await resolveConfigPath(root)
  const baseDir = path.dirname(outFile)

  if (fs.existsSync(outFile)) {
    debug(`Found existing config file ${outFile}`)
  } else {
    debug(`Creating config file ${outFile}`)
    await writeJsonFile(outFile, createDefaultConfig())
  }

  return { outFile, baseDir }
}

const BYTE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
}

/**
 * `--bodySizeLimit` as a byte count. Replaces the `bytes` package that
 * `express.json` used, and covers the suffixes a config update could plausibly
 * be given; anything else is a mistake at the command line and says so, rather
 * than silently becoming a default the user did not ask for.
 */
export function parseByteLimit(limit: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(limit.trim())
  const amount = match?.[1]
  const scale = BYTE_UNITS[(match?.[2] ?? 'b').toLowerCase()]
  if (amount === undefined || scale === undefined) {
    throw new Error(
      `${limit} is not a valid body size limit; use a number optionally followed by b, kb, mb or gb`,
    )
  }
  return Math.floor(Number(amount) * scale)
}

/** A request body that was over the limit, so the handler can answer 413. */
class PayloadTooLargeError extends Error {}

/**
 * The JSON body, or `undefined` when the request carried none. The size is
 * counted as it streams rather than after, so an oversized upload is refused
 * without being buffered first — which is the only reason the limit exists.
 */
async function readJsonBody(req: http.IncomingMessage, limitBytes: number) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += buffer.length
    if (size > limitBytes) {
      throw new PayloadTooLargeError(`request body exceeds ${limitBytes} bytes`)
    }
    chunks.push(buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  const parsed: unknown = raw === '' ? undefined : JSON.parse(raw)
  return parsed
}

// A missing or non-object body yields no properties instead of throwing, so a
// route reading it before checking the key cannot turn an unauthorized request
// into a 500.
function requestBody(body: unknown): Record<string, unknown> {
  return isRecord(body) ? body : {}
}

// body and query values are untrusted input: a repeated query param arrives as
// an array, a nested one as an object, and neither is a key or a path
function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

// The shape `express` gave `req.query`, which the checks below are written
// against: absent, one value, or an array when the param was repeated. An array
// is not a string, so `asString` rejects it and a repeated `adminKey` or
// `config` fails rather than quietly using whichever copy came first.
function queryValue(params: URLSearchParams, name: string) {
  const values = params.getAll(name)
  return values.length === 0
    ? undefined
    : values.length === 1
      ? values[0]
      : values
}

// a discriminated union rather than { isValid, configPath? }, so a caller that
// checked the flag has configPath without asserting it is there
type ParamValidation =
  | { ok: true; configPath: string }
  | { ok: false; error: string }

function validateAndExtractParams({
  body,
  query,
  key,
  baseDir,
  outFile,
}: {
  body: Record<string, unknown>
  query: URLSearchParams
  key: string
  baseDir: string
  outFile: string
}): ParamValidation {
  const adminKey =
    asString(body.adminKey) || asString(queryValue(query, 'adminKey'))

  if (adminKey !== key) {
    return { ok: false, error: 'Invalid admin key' }
  }

  // a configPath that is there but is not a string (a JSON number, an object, a
  // repeated query param) is a malformed request, not an absent one — it must not
  // silently fall through to writing the default config
  const rawConfigPath = body.configPath || queryValue(query, 'config')
  const configPathParam = asString(rawConfigPath)
  if (rawConfigPath !== undefined && configPathParam === undefined) {
    return { ok: false, error: 'Failed to validate config path' }
  }

  const configPath = configPathParam
    ? path.normalize(path.join(baseDir, configPathParam))
    : outFile

  const relPath = path.relative(path.normalize(baseDir), configPath)

  if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
    return { ok: false, error: 'Cannot perform directory traversal' }
  }

  return { ok: true, configPath }
}

function sendText(res: http.ServerResponse, status: number, body: string) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(body)
}

// What `cors()` sent. The server binds to localhost for a browser tab on the
// same machine to talk to, and the admin key is what authorizes a write — the
// origin never was.
function applyCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function updateConfig({
  res,
  body,
  query,
  key,
  baseDir,
  outFile,
}: {
  res: http.ServerResponse
  body: Record<string, unknown>
  query: URLSearchParams
  key: string
  baseDir: string
  outFile: string
}) {
  // the key is checked before the payload is touched, so a request with no JSON
  // body gets the 401 it earned rather than a 500 from reading it
  const validation = validateAndExtractParams({
    body,
    query,
    key,
    baseDir,
    outFile,
  })
  if (validation.ok) {
    const config = body.config
    if (config === undefined) {
      sendText(res, 400, 'Error: Missing config in request body')
    } else {
      try {
        fs.writeFileSync(validation.configPath, JSON.stringify(config, null, 2))
        sendText(res, 200, 'Config updated successfully')
      } catch {
        sendText(res, 500, 'Error: Failed to update config')
      }
    }
  } else {
    sendText(res, 401, `Error: ${validation.error}`)
  }
}

function readConfig({
  res,
  body,
  query,
  key,
  baseDir,
  outFile,
}: {
  res: http.ServerResponse
  body: Record<string, unknown>
  query: URLSearchParams
  key: string
  baseDir: string
  outFile: string
}) {
  const validation = validateAndExtractParams({
    body,
    query,
    key,
    baseDir,
    outFile,
  })
  if (validation.ok) {
    try {
      if (fs.existsSync(validation.configPath)) {
        sendText(res, 200, fs.readFileSync(validation.configPath, 'utf8'))
      } else {
        sendText(res, 404, 'Error: Config file not found')
      }
    } catch (error) {
      console.error('Error reading config:', error)
      sendText(res, 500, 'Error: Failed to read config')
    }
  } else {
    sendText(res, 401, `Error: ${validation.error}`)
  }
}

/**
 * The static half, and why it runs for `/` before the greeting below does: an
 * admin server is pointed at a JBrowse install, so `/` has to load the app the
 * user came for. `serve-handler` owns the parts worth not writing — content
 * types, byte ranges (the same directory holds the BAM and CRAM files the app
 * fetches by range), directory handling and the traversal guard.
 */
async function serveStatic({
  req,
  res,
  baseDir,
}: {
  req: http.IncomingMessage
  res: http.ServerResponse
  baseDir: string
}) {
  await handler(req, res, { public: baseDir })
}

async function hasIndexHtml(baseDir: string) {
  return fs.promises
    .stat(path.join(baseDir, 'index.html'))
    .then(stats => stats.isFile())
    .catch(() => false)
}

/**
 * The whole server, as one request handler.
 *
 * Replaces express + cors + express.json. The four routes are exact paths with
 * no parameters, so the dispatch is a switch; the rest of what express supplied
 * is the body reader, the CORS headers and the static handler above.
 *
 * One deliberate difference: `GET /config` is always the admin route. Under
 * `express.static` a file literally named `config` sitting in the JBrowse
 * directory would have shadowed it, which is not a thing anyone wants and was
 * never intended.
 */
export function createRequestHandler({
  baseDir,
  outFile,
  key,
  serverRef,
  bodySizeLimit,
}: {
  baseDir: string
  outFile: string
  key: string
  serverRef: ServerRef
  bodySizeLimit: number
}) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    try {
      applyCorsHeaders(res)
      const url = new URL(req.url ?? '/', 'http://localhost')
      const route = `${req.method} ${url.pathname}`

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
      } else if (route === 'POST /updateConfig' || route === 'GET /config') {
        const body = requestBody(await readJsonBody(req, bodySizeLimit))
        const args = {
          res,
          body,
          query: url.searchParams,
          key,
          baseDir,
          outFile,
        }
        if (route === 'GET /config') {
          readConfig(args)
        } else {
          updateConfig(args)
        }
      } else if (route === 'POST /shutdown') {
        const body = requestBody(await readJsonBody(req, bodySizeLimit))
        if (asString(body.adminKey) === key) {
          sendText(res, 200, 'Server shutting down')
          setImmediate(() => {
            serverRef.current?.close()
          })
        } else {
          sendText(res, 401, 'Error: Invalid admin key')
        }
      } else if (url.pathname === '/' && !(await hasIndexHtml(baseDir))) {
        sendText(res, 200, 'JBrowse Admin Server')
      } else {
        await serveStatic({ req, res, baseDir })
      }
    } catch (error) {
      // the express error middleware this replaces, and registered after the
      // routes for the same reason: it has to catch what they and the body
      // reader throw
      if (!res.headersSent) {
        if (error instanceof PayloadTooLargeError) {
          sendText(res, 413, 'Error: Request body too large')
        } else if (error instanceof SyntaxError) {
          sendText(res, 400, 'Error: Malformed JSON in request body')
        } else {
          console.error('Server error:', error)
          sendText(res, 500, 'Internal Server Error')
        }
      }
    }
  }
}

export function startServer({
  server,
  port,
  key,
  outFile,
  serverRef,
}: {
  server: http.Server
  port: number
  key: string
  outFile: string
  serverRef: ServerRef
}): void {
  server.listen(port, () => {
    console.log(
      `Admin server started on port ${port}\n\n` +
        `To access the admin interface, open your browser to:\n` +
        `http://localhost:${port}?adminKey=${key}\n\n` +
        `Admin key: ${key}\n` +
        `Config file: ${outFile}\n\n` +
        `To stop the server, press Ctrl+C`,
    )
  })

  serverRef.current = server

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} is already in use`)
    } else {
      console.error('Server error:', error.message)
    }
    process.exit(1)
  })

  const shutdownHandler = () => {
    console.log('\nShutting down admin server...')
    server.close(() => {
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdownHandler)
  process.on('SIGTERM', shutdownHandler)
}
