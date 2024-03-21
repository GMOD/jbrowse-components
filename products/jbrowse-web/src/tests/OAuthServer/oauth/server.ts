import OAuthServer from '@node-oauth/express-oauth-server'
import model from './model'

export default new OAuthServer({
  accessTokenLifetime: 5,
  allowEmptyState: true,
  allowExtendedTokenAttributes: true,
  model,
  requireClientAuthentication: {
    authorization_code: false,
    refresh_token: false,
  },
})
