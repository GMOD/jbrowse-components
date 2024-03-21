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

export default class AuthenticationPlugin extends Plugin {
  name = 'AuthenticationPlugin'

  exports = {
    DropboxOAuthConfigSchema,
    DropboxOAuthInternetAccountModelFactory,
    ExternalTokenConfigSchema,
    ExternalTokenInternetAccountModelFactory,
    GoogleDriveOAuthConfigSchema,
    GoogleDriveOAuthInternetAccountModelFactory,
    HTTPBasicConfigSchema,
    HTTPBasicInternetAccountModelFactory,
    OAuthConfigSchema,
    OAuthInternetAccountModelFactory,
  }

  install(pluginManager: PluginManager) {
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

export {
  configSchema as OAuthConfigSchema,
  modelFactory as OAuthInternetAccountModelFactory,
} from './OAuthModel'
export {
  configSchema as ExternalTokenConfigSchema,
  modelFactory as ExternalTokenInternetAccountModelFactory,
} from './ExternalTokenModel'

export {
  configSchema as HTTPBasicConfigSchema,
  modelFactory as HTTPBasicInternetAccountModelFactory,
} from './HTTPBasicModel'

export {
  configSchema as DropboxOAuthConfigSchema,
  modelFactory as DropboxOAuthInternetAccountModelFactory,
} from './DropboxOAuthModel'

export {
  configSchema as GoogleDriveOAuthConfigSchema,
  modelFactory as GoogleDriveOAuthInternetAccountModelFactory,
} from './GoogleDriveOAuthModel'
