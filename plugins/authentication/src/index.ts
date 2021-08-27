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

export default class AuthenticationPlugin extends Plugin {
  name = 'AuthenticationPlugin'

  install(pluginManager: PluginManager) {
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
