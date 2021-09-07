import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import InternetAccountType from '@jbrowse/core/pluggableElementTypes/InternetAccountType'
import {
  configSchemaFactory as OAuthConfigSchemaFactory,
  modelFactory as OAuthInternetAccountModelFactory,
} from './OAuthModel'
import {
  configSchemaFactory as ExternalTokenConfigSchemaFactory,
  modelFactory as ExternalTokenInternetAccountModelFactory,
} from './ExternalTokenModel'
import {
  configSchemaFactory as HTTPBasicConfigSchemaFactory,
  modelFactory as HTTPBasicInternetAccountModelFactory,
} from './HTTPBasicModel'
import {
  configSchemaFactory as DropboxOAuthConfigSchemaFactory,
  modelFactory as DropboxOAuthInternetAccountModelFactory,
} from './DropboxOAuthModel'
import {
  configSchemaFactory as GoogleDriveOAuthConfigSchemaFactory,
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
      const configSchema = OAuthConfigSchemaFactory(pluginManager)
      return new InternetAccountType({
        name: 'OAuthInternetAccount',
        configSchema: configSchema,
        stateModel: OAuthInternetAccountModelFactory(
          pluginManager,
          configSchema,
        ),
      })
    })
    pluginManager.addInternetAccountType(() => {
      const configSchema = ExternalTokenConfigSchemaFactory(pluginManager)
      return new InternetAccountType({
        name: 'ExternalTokenInternetAccount',
        configSchema: configSchema,
        stateModel: ExternalTokenInternetAccountModelFactory(
          pluginManager,
          configSchema,
        ),
      })
    })
    pluginManager.addInternetAccountType(() => {
      const configSchema = HTTPBasicConfigSchemaFactory(pluginManager)
      return new InternetAccountType({
        name: 'HTTPBasicInternetAccount',
        configSchema: configSchema,
        stateModel: HTTPBasicInternetAccountModelFactory(
          pluginManager,
          configSchema,
        ),
      })
    })
    pluginManager.addInternetAccountType(() => {
      const configSchema = DropboxOAuthConfigSchemaFactory(pluginManager)
      return new InternetAccountType({
        name: 'DropboxOAuthInternetAccount',
        configSchema: configSchema,
        stateModel: DropboxOAuthInternetAccountModelFactory(
          pluginManager,
          configSchema,
        ),
      })
    })
    pluginManager.addInternetAccountType(() => {
      const configSchema = GoogleDriveOAuthConfigSchemaFactory(pluginManager)
      return new InternetAccountType({
        name: 'GoogleDriveOAuthInternetAccount',
        configSchema: configSchema,
        stateModel: GoogleDriveOAuthInternetAccountModelFactory(
          pluginManager,
          configSchema,
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
    type: 'HTTPBasicInternetAccount',
    internetAccountId: 'HTTPBasicTest',
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})
