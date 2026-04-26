import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import { debug, resolveConfigPath, writeJsonFile } from '../../utils.ts'
import { createDefaultConfig } from '../add-assembly/utils.ts'

import type { Express, Request, Response } from 'express'
import type http from 'http'

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
  if (!(parsedPort > 0 && parsedPort < 65535)) {
    throw new Error(`${portStr} is not a valid port`)
  }

  return parsedPort
}

export function generateKey(): string {
  return crypto.randomBytes(5).toString('hex')
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
}): { isValid: boolean; configPath?: string; error?: string } {
  const { body } = req
  const adminKey =
    (body?.adminKey as string | undefined) ||
    (req.query.adminKey as string | undefined)

  if (adminKey !== key) {
    return { isValid: false, error: 'Invalid admin key' }
  }

  const configPathParam =
    body?.configPath || (req.query.config as string | undefined)

  try {
    const configPath = configPathParam
      ? path.normalize(path.join(baseDir, configPathParam))
      : outFile

    const normalizedBaseDir = path.normalize(baseDir)
    const relPath = path.relative(normalizedBaseDir, configPath)

    if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
      return { isValid: false, error: 'Cannot perform directory traversal' }
    }

    return { isValid: true, configPath }
  } catch (error) {
    return { isValid: false, error: 'Failed to validate config path' }
  }
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
    res.setHeader('Content-Type', 'text/plain')
    res.send('JBrowse Admin Server')
  })

  app.post('/updateConfig', (req: Request, res: Response) => {
    const { body } = req
    const config = body.config as string | undefined

    const validation = validateAndExtractParams({ req, key, baseDir, outFile })
    if (!validation.isValid) {
      res.status(401).setHeader('Content-Type', 'text/plain')
      res.send(`Error: ${validation.error}`)
      return
    }

    if (body.adminKey) {
      delete body.adminKey
    }

    try {
      fs.writeFileSync(validation.configPath!, JSON.stringify(config, null, 2))
      res.setHeader('Content-Type', 'text/plain')
      res.send('Config updated successfully')
    } catch (error) {
      res.status(500).setHeader('Content-Type', 'text/plain')
      res.send('Error: Failed to update config')
    }
  })

  app.get('/config', (req: Request, res: Response) => {
    const validation = validateAndExtractParams({ req, key, baseDir, outFile })
    if (!validation.isValid) {
      res.status(401).setHeader('Content-Type', 'text/plain')
      res.send(`Error: ${validation.error}`)
      return
    }

    try {
      if (fs.existsSync(validation.configPath!)) {
        const config = fs.readFileSync(validation.configPath!, 'utf8')
        res.setHeader('Content-Type', 'text/plain')
        res.send(config)
      } else {
        res.status(404).setHeader('Content-Type', 'text/plain')
        res.send('Error: Config file not found')
      }
    } catch (error) {
      console.error('Error reading config:', error)
      res.status(500).setHeader('Content-Type', 'text/plain')
      res.send('Error: Failed to read config')
    }
  })

  app.post('/shutdown', (req: Request, res: Response) => {
    const { body } = req
    const adminKey = body?.adminKey as string | undefined

    if (adminKey !== key) {
      res.status(401).setHeader('Content-Type', 'text/plain')
      res.send('Error: Invalid admin key')
      return
    }

    res.setHeader('Content-Type', 'text/plain')
    res.send('Server shutting down')

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
  keyPath,
  serverRef,
}: {
  app: Express
  port: number
  key: string
  outFile: string
  keyPath: string
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
      try {
        fs.unlinkSync(keyPath)
        debug(`Removed admin key file: ${keyPath}`)
      } catch (error) {
        // Ignore errors when cleaning up
      }
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdownHandler)
  process.on('SIGTERM', shutdownHandler)
}
