import crypto from 'crypto'

import {
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
  async generateAuthorizationCode(_client, _user, _scope) {
    const seed = crypto.randomBytes(256)
    const code = crypto.createHash('sha1').update(seed).digest('hex')
    return code
  },
  async getAccessToken(token) {
    /* This is where you select the token from the database where the code matches */
    if (!token || token === 'undefined') {
      return false
    }
    return db.token
  },
  async getAuthorizationCode(_authorizationCode) {
    /* this is where we fetch the stored data from the code */
    return db.authorizationCode
  },
  async getClient(clientId, clientSecret) {
    if (db.client) {
      return db.client
    }
    db.client = {
      clientSecret,

      grants: ['authorization_code', 'refresh_token'],
      // Retrieved from the database
      id: clientId,
      redirectUris: ['http://localhost:3000/'],
    }
    return db.client
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
  async revokeAuthorizationCode(_authorizationCode) {
    /* This is where we delete codes */
    delete db.authorizationCode
    const codeWasFoundAndDeleted = true // Return true if code found and deleted, false otherwise
    return codeWasFoundAndDeleted
  },
  async revokeToken(token) {
    /* Delete the token from the database */
    if (!token) {
      return false
    }
    return true
  },
  async saveAuthorizationCode(code, client, user) {
    /* This is where you store the access code data into the database */
    db.authorizationCode = {
      authorizationCode: code.authorizationCode,
      client: client,
      expiresAt: code.expiresAt,
      redirectUri: code.redirectUri,
      user: user,
    }
    return db.authorizationCode
  },
  async saveToken(token, client, user) {
    /* This is where you insert the token into the database */
    db.token = {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      client: client,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      user: user,
    }
    return db.token
  },
  async verifyScope(_token, _scope) {
    /* This is where we check to make sure the client has access to this scope */
    const userHasAccess = true // return true if this user / client combo has access to this resource
    return userHasAccess
  },
}

export default model
