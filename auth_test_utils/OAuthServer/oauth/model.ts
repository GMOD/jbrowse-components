import crypto from 'crypto'

import type {
  Client,
  RefreshToken,
  RefreshTokenModel,
  AuthorizationCode,
  AuthorizationCodeModel,
  Token,
} from '@node-oauth/oauth2-server'

interface MyModel extends RefreshTokenModel, AuthorizationCodeModel {}

// See https://oauth2-server.readthedocs.io/en/latest/model/spec.html for what you can do with this
const db: {
  authorizationCode?: AuthorizationCode
  client?: Client
  token?: Token
} = {}

const model: MyModel = {
  async getClient(clientId, clientSecret) {
    if (db.client) {
      return db.client
    }
    db.client = {
      // Retrieved from the database
      id: clientId,
      clientSecret,
      grants: ['authorization_code', 'refresh_token'],
      redirectUris: ['http://localhost:3000/'],
    }
    return db.client
  },
  async saveToken(token, client, user) {
    /* This is where you insert the token into the database */
    db.token = {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      client: client,
      user: user,
    }
    return db.token
  },
  async getAccessToken(token) {
    /* This is where you select the token from the database where the code matches */
    if (!token || token === 'undefined') {
      return false
    }
    return db.token
  },
  async getRefreshToken(_token) {
    /* Retrieves the token from the database */
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
    /* Delete the token from the database */

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!token) {
      return false
    }
    return true
  },
  async generateAuthorizationCode(_client, _user, _scope) {
    const seed = crypto.randomBytes(256)
    const code = crypto.createHash('sha1').update(seed).digest('hex')
    return code
  },
  async saveAuthorizationCode(code, client, user) {
    /* This is where you store the access code data into the database */
    db.authorizationCode = {
      authorizationCode: code.authorizationCode,
      expiresAt: code.expiresAt,
      client: client,
      user: user,
      redirectUri: code.redirectUri,
    }
    return db.authorizationCode
  },
  async getAuthorizationCode(_authorizationCode) {
    /* this is where we fetch the stored data from the code */
    return db.authorizationCode
  },
  async revokeAuthorizationCode(_authorizationCode) {
    /* This is where we delete codes */
    db.authorizationCode = undefined
    const codeWasFoundAndDeleted = true // Return true if code found and deleted, false otherwise
    return codeWasFoundAndDeleted
  },
  async verifyScope(_token, _scope) {
    /* This is where we check to make sure the client has access to this scope */
    const userHasAccess = true // return true if this user / client combo has access to this resource
    return userHasAccess
  },
}

export default model
