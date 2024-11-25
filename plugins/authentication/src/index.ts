import Plugin from '@jbrowse/core/Plugin'
import InternetAccountType from '@jbrowse/core/pluggableElementTypes/InternetAccountType'
import {
  configSchema as DropboxOAuthConfigSchema,
  modelFactory as DropboxOAuthInternetAccountModelFactory,
} from './DropboxOAuthModel'
import {
  configSchema as ExternalTokenConfigSchema,
  modelFactory as ExternalTokenInternetAccountModelFactory,
} from './ExternalTokenModel'
import {
  configSchema as GoogleDriveOAuthConfigSchema,
  modelFactory as GoogleDriveOAuthInternetAccountModelFactory,
} from './GoogleDriveOAuthModel'
import {
  configSchema as HTTPBasicConfigSchema,
  modelFactory as HTTPBasicInternetAccountModelFactory,
} from './HTTPBasicModel'
import {
  configSchema as OAuthConfigSchema,
  modelFactory as OAuthInternetAccountModelFactory,
} from './OAuthModel'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class AuthenticationPlugin extends Plugin {
  name = 'AuthenticationPlugin'

  exports = {
    OAuthConfigSchema,
    OAuthInternetAccountModelFactory,
    ExternalTokenConfigSchema,
    ExternalTokenInternetAccountModelFactory,
    HTTPBasicConfigSchema,
    HTTPBasicInternetAccountModelFactory,
    DropboxOAuthConfigSchema,
    DropboxOAuthInternetAccountModelFactory,
    GoogleDriveOAuthConfigSchema,
    GoogleDriveOAuthInternetAccountModelFactory,
  }

  install(pluginManager: PluginManager) {
    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        name: 'OAuthInternetAccount',
        configSchema: OAuthConfigSchema,
        stateModel: OAuthInternetAccountModelFactory(OAuthConfigSchema),
      })
    })
    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        name: 'ExternalTokenInternetAccount',
        configSchema: ExternalTokenConfigSchema,
        stateModel: ExternalTokenInternetAccountModelFactory(
          ExternalTokenConfigSchema,
        ),
      })
    })
    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        name: 'HTTPBasicInternetAccount',
        configSchema: HTTPBasicConfigSchema,
        stateModel: HTTPBasicInternetAccountModelFactory(HTTPBasicConfigSchema),
      })
    })
    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        name: 'DropboxOAuthInternetAccount',
        configSchema: DropboxOAuthConfigSchema,
        stateModel: DropboxOAuthInternetAccountModelFactory(
          DropboxOAuthConfigSchema,
        ),
      })
    })
    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        name: 'GoogleDriveOAuthInternetAccount',
        configSchema: GoogleDriveOAuthConfigSchema,
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
