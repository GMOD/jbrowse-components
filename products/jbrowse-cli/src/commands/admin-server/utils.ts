import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  debug,
  isRecord,
  resolveConfigPath,
  writeJsonFile,
} from '../../utils.ts'
import { createDefaultConfig } from '../add-assembly/utils.ts'

import type { Express, Request, Response } from 'express'
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

// express types req.body as `any`, and express 5 leaves it undefined when no
// JSON body was parsed. Every read goes through here so a missing or non-object
// body yields no properties instead of throwing, and nothing downstream sees
// `any`.
function requestBody(req: Request): Record<string, unknown> {
  const body: unknown = req.body
  return isRecord(body) ? body : {}
}

// body and query values are untrusted input: a repeated query param arrives as
// an array, a nested one as an object, and neither is a key or a path
function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

// a discriminated union rather than { isValid, configPath? }, so a caller that
// checked the flag has configPath without asserting it is there
type ParamValidation =
  | { ok: true; configPath: string }
  | { ok: false; error: string }

function validateAndExtractParams({
  req,
  key,
  baseDir,
  outFile,
}: {
  req: Request
  key: string
  baseDir: string
  outFile: string
}): ParamValidation {
  const body = requestBody(req)
  const adminKey = asString(body.adminKey) || asString(req.query.adminKey)

  if (adminKey !== key) {
    return { ok: false, error: 'Invalid admin key' }
  }

  // a configPath that is there but is not a string (a JSON number, an object, a
  // repeated query param) is a malformed request, not an absent one — it must not
  // silently fall through to writing the default config
  const rawConfigPath = body.configPath || req.query.config
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

function sendText(res: Response, status: number, body: string) {
  res.status(status).setHeader('Content-Type', 'text/plain')
  res.send(body)
}

export function setupRoutes({
  app,
  baseDir,
  outFile,
  key,
  serverRef,
}: {
  app: Express
  baseDir: string
  outFile: string
  key: string
  serverRef: ServerRef
}): void {
  app.get('/', (_req: Request, res: Response) => {
    sendText(res, 200, 'JBrowse Admin Server')
  })

  app.post('/updateConfig', (req: Request, res: Response) => {
    // the key is checked before the payload is touched: reading req.body first
    // turned a request with no JSON body (express 5 leaves body undefined) into
    // a TypeError and a 500 rather than the 401 it had earned
    const validation = validateAndExtractParams({ req, key, baseDir, outFile })
    if (!validation.ok) {
      sendText(res, 401, `Error: ${validation.error}`)
      return
    }

    const config = requestBody(req).config
    if (config === undefined) {
      sendText(res, 400, 'Error: Missing config in request body')
      return
    }

    try {
      fs.writeFileSync(validation.configPath, JSON.stringify(config, null, 2))
      sendText(res, 200, 'Config updated successfully')
    } catch {
      sendText(res, 500, 'Error: Failed to update config')
    }
  })

  app.get('/config', (req: Request, res: Response) => {
    const validation = validateAndExtractParams({ req, key, baseDir, outFile })
    if (!validation.ok) {
      sendText(res, 401, `Error: ${validation.error}`)
      return
    }

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
  })

  app.post('/shutdown', (req: Request, res: Response) => {
    if (asString(requestBody(req).adminKey) !== key) {
      sendText(res, 401, 'Error: Invalid admin key')
      return
    }

    sendText(res, 200, 'Server shutting down')

    setImmediate(() => {
      if (serverRef.current) {
        serverRef.current.close()
      }
    })
  })
}

export function startServer({
  app,
  port,
  key,
  outFile,
  serverRef,
}: {
  app: Express
  port: number
  key: string
  outFile: string
  serverRef: ServerRef
}): void {
  const server = app.listen(port, () => {
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
