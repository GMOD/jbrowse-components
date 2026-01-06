import Plugin from '@jbrowse/core/Plugin'
import InternetAccountType from '@jbrowse/core/pluggableElementTypes/InternetAccountType'

import {
  configSchema as DropboxOAuthConfigSchema,
  modelFactory as DropboxOAuthInternetAccountModelFactory,
} from './DropboxOAuthModel/index.ts'
import {
  configSchema as ExternalTokenConfigSchema,
  modelFactory as ExternalTokenInternetAccountModelFactory,
} from './ExternalTokenModel/index.ts'
import {
  configSchema as GoogleDriveOAuthConfigSchema,
  modelFactory as GoogleDriveOAuthInternetAccountModelFactory,
} from './GoogleDriveOAuthModel/index.ts'
import {
  configSchema as HTTPBasicConfigSchema,
  modelFactory as HTTPBasicInternetAccountModelFactory,
} from './HTTPBasicModel/index.ts'
import {
  configSchema as OAuthConfigSchema,
  modelFactory as OAuthInternetAccountModelFactory,
} from './OAuthModel/index.ts'

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
} from './OAuthModel/index.ts'
export {
  configSchema as ExternalTokenConfigSchema,
  modelFactory as ExternalTokenInternetAccountModelFactory,
} from './ExternalTokenModel/index.ts'

export {
  configSchema as HTTPBasicConfigSchema,
  modelFactory as HTTPBasicInternetAccountModelFactory,
} from './HTTPBasicModel/index.ts'

export {
  configSchema as DropboxOAuthConfigSchema,
  modelFactory as DropboxOAuthInternetAccountModelFactory,
} from './DropboxOAuthModel/index.ts'

export {
  configSchema as GoogleDriveOAuthConfigSchema,
  modelFactory as GoogleDriveOAuthInternetAccountModelFactory,
} from './GoogleDriveOAuthModel/index.ts'
