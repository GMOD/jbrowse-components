/* eslint-disable no-console */
import crypto from 'crypto'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

import OAuthServer from '@node-oauth/express-oauth-server'
import cors from 'cors'
import express from 'express'
import expressBasicAuth from 'express-basic-auth'

import type {
  AuthorizationCode,
  AuthorizationCodeModel,
  Client,
  RefreshToken,
  RefreshTokenModel,
  Token,
} from '@node-oauth/oauth2-server'
import type { Request } from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultDataPath = path.resolve(__dirname, '../test_data/volvox')

interface OAuthModel extends RefreshTokenModel, AuthorizationCodeModel {}

function createOAuthModel(redirectPort: number): OAuthModel {
  const db: {
    authorizationCode?: AuthorizationCode
    client?: Client
    token?: Token
  } = {}

  return {
    async getClient(clientId, clientSecret) {
      if (db.client) {
        return db.client
      }
      db.client = {
        id: clientId,
        clientSecret,
        grants: ['authorization_code', 'refresh_token'],
        redirectUris: [`http://localhost:${redirectPort}/`],
      }
      return db.client
    },
    async saveToken(token, client, user) {
      db.token = {
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        client,
        user,
      }
      return db.token
    },
    async getAccessToken(token) {
      if (!token || token === 'undefined') {
        return false
      }
      return db.token
    },
    async getRefreshToken(_token) {
      const { token: dbToken } = db
      if (!dbToken) {
        throw new Error('No token')
      }
      if (!('refreshToken' in dbToken)) {
        throw new Error('No refresh token')
      }
      return dbToken as RefreshToken
    },
    async revokeToken(token) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!token) {
        return false
      }
      return true
    },
    async generateAuthorizationCode(_client, _user, _scope) {
      const seed = crypto.randomBytes(256)
      return crypto.createHash('sha1').update(seed).digest('hex')
    },
    async saveAuthorizationCode(code, client, user) {
      db.authorizationCode = {
        authorizationCode: code.authorizationCode,
        expiresAt: code.expiresAt,
        client,
        user,
        redirectUri: code.redirectUri,
      }
      return db.authorizationCode
    },
    async getAuthorizationCode(_authorizationCode) {
      return db.authorizationCode
    },
    async revokeAuthorizationCode(_authorizationCode) {
      db.authorizationCode = undefined
      return true
    },
    async verifyScope(_token, _scope) {
      return true
    },
  }
}

export interface AuthServerOptions {
  port: number
  redirectPort?: number
  dataPath?: string
}

export function startOAuthServer(
  options: AuthServerOptions,
): Promise<http.Server> {
  const { port, redirectPort = 3000, dataPath = defaultDataPath } = options

  return new Promise(resolve => {
    const oauthServer = new OAuthServer({
      model: createOAuthModel(redirectPort),
      accessTokenLifetime: 5,
      allowEmptyState: true,
      allowExtendedTokenAttributes: true,
      requireClientAuthentication: {
        authorization_code: false,
        refresh_token: false,
      },
    })

    const router = express.Router()

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

    router.post(
      '/authorize',
      (req, res, next) => {
        const { username, password } = req.body
        if (username === 'username' && password === 'password') {
          req.body.user = { user: 1 }
          next()
          return
        }
        const params = [
          'client_id',
          'redirect_uri',
          'response_type',
          'grant_type',
          'state',
        ]
          .map(a => `${a}=${req.body[a]}`)
          .join('&')
        res.redirect(`/oauth?success=false&${params}`)
      },
      oauthServer.authorize({
        authenticateHandler: {
          handle: (req: Request) => req.body.user,
        },
      }),
    )

    router.post('/token', oauthServer.token())

    const app = express()
    app.use(cors())
    app.use(express.urlencoded({ extended: false }))
    app.use(express.json())
    app.use('/oauth', router)
    app.use('/data', oauthServer.authenticate(), express.static(dataPath))

    const server = app.listen(port, () => {
      console.log(`OAuth Server listening on port ${port}`)
      resolve(server)
    })
  })
}

export function startBasicAuthServer(
  options: AuthServerOptions,
): Promise<http.Server> {
  const { port, dataPath = defaultDataPath } = options

  return new Promise(resolve => {
    const app = express()
    app.use(cors())
    app.use(
      '/data',
      expressBasicAuth({ users: { admin: 'password' } }),
      express.static(dataPath),
    )

    const server = app.listen(port, () => {
      console.log(`HTTP BasicAuth Server listening on port ${port}`)
      resolve(server)
    })
  })
}
