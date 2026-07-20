/* eslint-disable no-console */
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import cors from 'cors'
import express, {
  Router,
  json,
  static as serveStatic,
  urlencoded,
} from 'express'

import type { RequestHandler } from 'express'
import type http from 'node:http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultDataPath = path.resolve(__dirname, '../test_data/volvox')

// Short-lived access tokens so the e2e flow exercises the refresh-token path.
const ACCESS_TOKEN_LIFETIME_SEC = 5

function randomToken() {
  return crypto.randomBytes(32).toString('hex')
}

interface Token {
  accessToken: string
  accessTokenExpiresAt: number
  refreshToken: string
}

export interface AuthServerOptions {
  port: number
  redirectPort?: number
  dataPath?: string
}

// Minimal in-memory OAuth2 test double, replacing @node-oauth/express-oauth-server.
// It supports only what the JBrowse OAuthInternetAccount e2e tests drive — the
// authorization-code and refresh-token grants plus bearer gating on /data — not
// the full spec. Single client, single token; the demo username/password and the
// redirect origin are checked, and PKCE params are accepted and ignored.
export function startOAuthServer(
  options: AuthServerOptions,
): Promise<http.Server> {
  const { port, redirectPort = 3000, dataPath = defaultDataPath } = options
  const redirectOrigin = `http://localhost:${redirectPort}`

  let authorizationCode: string | undefined
  let token: Token | undefined

  function issueToken() {
    token = {
      accessToken: randomToken(),
      accessTokenExpiresAt: Date.now() + ACCESS_TOKEN_LIFETIME_SEC * 1000,
      refreshToken: randomToken(),
    }
    return {
      access_token: token.accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_LIFETIME_SEC,
      refresh_token: token.refreshToken,
    }
  }

  const authenticate: RequestHandler = (req, res, next) => {
    const presented = /^Bearer (\S+)$/.exec(
      req.headers.authorization ?? '',
    )?.[1]
    const valid =
      token !== undefined &&
      presented === token.accessToken &&
      Date.now() < token.accessTokenExpiresAt
    if (valid) {
      next()
    } else {
      res.status(401).send('Unauthorized')
    }
  }

  return new Promise(resolve => {
    const router = Router()

    router.get('/', (_req, res) => {
      res.send(`
        <!doctype html>
        <html>
          <body>
            <form action="/oauth/authorize" method="post">
              <input name="client_id" type="hidden" />
              <input name="redirect_uri" type="hidden" />
              <input name="response_type" type="hidden" />
              <input name="grant_type" type="hidden" />
              <input name="state" type="hidden" />
              <input type="text" name="username" value="username" />
              <input type="text" name="password" value="password" />
              <input type="submit" />
            </form>
            <script>
              const urlParams = new URLSearchParams(window.location.search);
              ['client_id', 'redirect_uri', 'response_type', 'grant_type', 'state'].forEach(type => {
                document.body.querySelector('input[name=' + type + ']').value = urlParams.get(type);
              });
            </script>
          </body>
        </html>
      `)
    })

    router.post('/authorize', (req, res) => {
      const body = req.body as Record<string, string>
      const { username, password, redirect_uri, state } = body
      const credsOk = username === 'username' && password === 'password'
      if (credsOk && redirect_uri?.startsWith(redirectOrigin)) {
        const code = randomToken()
        authorizationCode = code
        const url = new URL(redirect_uri)
        url.searchParams.set('code', code)
        if (state) {
          url.searchParams.set('state', state)
        }
        res.redirect(url.toString())
      } else {
        const params = [
          'client_id',
          'redirect_uri',
          'response_type',
          'grant_type',
          'state',
        ]
          .map(a => `${a}=${body[a]}`)
          .join('&')
        res.redirect(`/oauth?success=false&${params}`)
      }
    })

    router.post('/token', (req, res) => {
      const body = req.body as Record<string, string>
      if (body.grant_type === 'authorization_code') {
        if (body.code && body.code === authorizationCode) {
          authorizationCode = undefined // single-use
          res.json(issueToken())
        } else {
          res.status(400).json({ error: 'invalid_grant' })
        }
      } else if (body.grant_type === 'refresh_token') {
        if (token && body.refresh_token === token.refreshToken) {
          res.json(issueToken())
        } else {
          res.status(400).json({ error: 'invalid_grant' })
        }
      } else {
        res.status(400).json({ error: 'unsupported_grant_type' })
      }
    })

    const app = express()
    app.use(cors())
    app.use(urlencoded({ extended: false }))
    app.use(json())
    app.use('/oauth', router)
    app.use('/data', authenticate, serveStatic(dataPath))

    const server = app.listen(port, () => {
      console.log(`OAuth Server listening on port ${port}`)
      resolve(server)
    })
  })
}

// HTTP Basic auth without a WWW-Authenticate challenge: JBrowse prompts for
// credentials via its own UI, so a challenge header (which triggers the browser's
// native login dialog) would break the test flow. Replaces express-basic-auth.
function basicAuth(users: Record<string, string>): RequestHandler {
  return (req, res, next) => {
    const encoded = /^Basic (\S+)$/.exec(req.headers.authorization ?? '')?.[1]
    const [user, pass] = encoded
      ? Buffer.from(encoded, 'base64').toString().split(':')
      : []
    if (user !== undefined && users[user] === pass) {
      next()
    } else {
      res.status(401).send('Unauthorized')
    }
  }
}

export function startBasicAuthServer(
  options: AuthServerOptions,
): Promise<http.Server> {
  const { port, dataPath = defaultDataPath } = options

  return new Promise(resolve => {
    const app = express()
    app.use(cors())
    // Per-path credentials must mount BEFORE the catch-all `/data`: express
    // matches in registration order, and a failed auth on `/data` 401s before
    // the more-specific handler is reached. These back the "multiple BasicAuth
    // credentials on same domain" test (alice/bob).
    app.use(
      '/data/public',
      basicAuth({ alice: 'public123' }),
      serveStatic(dataPath),
    )
    app.use(
      '/data/private',
      basicAuth({ bob: 'private456' }),
      serveStatic(dataPath),
    )
    app.use('/data', basicAuth({ admin: 'password' }), serveStatic(dataPath))

    const server = app.listen(port, () => {
      console.log(`HTTP BasicAuth Server listening on port ${port}`)
      resolve(server)
    })
  })
}
