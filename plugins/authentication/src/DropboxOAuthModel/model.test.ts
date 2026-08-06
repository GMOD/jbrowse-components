import configSchema from './configSchema.ts'
import stateModelFactory from './model.tsx'

test('the authorization request asks Dropbox for offline access', () => {
  const account = stateModelFactory(configSchema).create({
    type: 'DropboxOAuthInternetAccount',
    configuration: {
      type: 'DropboxOAuthInternetAccount',
      internetAccountId: 'testDropbox',
      clientId: 'test-client',
    },
  })
  // without this Dropbox issues no refresh token at all, so the account can
  // only ever last as long as its first access token
  expect(account.authFlowParams).toEqual({ token_access_type: 'offline' })
})
