import OAuthServer from '@node-oauth/express-oauth-server'
import model from './model'

export default new OAuthServer({
  model,
  accessTokenLifetime: 5,
  allowEmptyState: true,
  allowExtendedTokenAttributes: true,
  requireClientAuthentication: {
    authorization_code: false,
    refresh_token: false,
  },
})
