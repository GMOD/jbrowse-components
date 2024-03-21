import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import InternetAccountType from '@jbrowse/core/pluggableElementTypes/InternetAccountType'
import {
  configSchema as OAuthConfigSchema,
  modelFactory as OAuthInternetAccountModelFactory,
} from './OAuthModel'
import {
  configSchema as ExternalTokenConfigSchema,
  modelFactory as ExternalTokenInternetAccountModelFactory,
} from './ExternalTokenModel'
import {
  configSchema as HTTPBasicConfigSchema,
  modelFactory as HTTPBasicInternetAccountModelFactory,
} from './HTTPBasicModel'
import {
  configSchema as DropboxOAuthConfigSchema,
  modelFactory as DropboxOAuthInternetAccountModelFactory,
} from './DropboxOAuthModel'
import {
  configSchema as GoogleDriveOAuthConfigSchema,
  modelFactory as GoogleDriveOAuthInternetAccountModelFactory,
} from './GoogleDriveOAuthModel'
import { getSnapshot } from 'mobx-state-tree'

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  console.warn.mockRestore()
})

class AuthenticationPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        configSchema: OAuthConfigSchema,
        name: 'OAuthInternetAccount',
        stateModel: OAuthInternetAccountModelFactory(OAuthConfigSchema),
      })
    })
    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        configSchema: ExternalTokenConfigSchema,
        name: 'ExternalTokenInternetAccount',
        stateModel: ExternalTokenInternetAccountModelFactory(
          ExternalTokenConfigSchema,
        ),
      })
    })
    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        configSchema: HTTPBasicConfigSchema,
        name: 'HTTPBasicInternetAccount',
        stateModel: HTTPBasicInternetAccountModelFactory(HTTPBasicConfigSchema),
      })
    })
    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        configSchema: DropboxOAuthConfigSchema,
        name: 'DropboxOAuthInternetAccount',
        stateModel: DropboxOAuthInternetAccountModelFactory(
          DropboxOAuthConfigSchema,
        ),
      })
    })
    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        configSchema: GoogleDriveOAuthConfigSchema,
        name: 'GoogleDriveOAuthInternetAccount',
        stateModel: GoogleDriveOAuthInternetAccountModelFactory(
          GoogleDriveOAuthConfigSchema,
        ),
      })
    })
  }
}

test('initialized correctly', () => {
  const pm = new PluginManager([
    new AuthenticationPlugin(),
  ]).createPluggableElements()

  expect(Object.values(pm.internetAccountTypes.registeredTypes).length).toEqual(
    5,
  )

  const HTTPBasic = pm.getInternetAccountType('HTTPBasicInternetAccount')
  const config = HTTPBasic.configSchema.create({
    internetAccountId: 'HTTPBasicTest',
    type: 'HTTPBasicInternetAccount',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})
