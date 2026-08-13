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
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

// Generic so each call checks its own factory against its own schema — the
// three vary together and a table of them would only agree on their union
function accountType<Schema extends AnyConfigurationSchemaType>(
  name: string,
  configSchema: Schema,
  modelFactory: (configSchema: Schema) => IAnyModelType,
) {
  return () =>
    new InternetAccountType({
      name,
      configSchema,
      stateModel: modelFactory(configSchema),
    })
}

const internetAccountTypes = [
  accountType(
    'OAuthInternetAccount',
    OAuthConfigSchema,
    OAuthInternetAccountModelFactory,
  ),
  accountType(
    'ExternalTokenInternetAccount',
    ExternalTokenConfigSchema,
    ExternalTokenInternetAccountModelFactory,
  ),
  accountType(
    'HTTPBasicInternetAccount',
    HTTPBasicConfigSchema,
    HTTPBasicInternetAccountModelFactory,
  ),
  accountType(
    'DropboxOAuthInternetAccount',
    DropboxOAuthConfigSchema,
    DropboxOAuthInternetAccountModelFactory,
  ),
  accountType(
    'GoogleDriveOAuthInternetAccount',
    GoogleDriveOAuthConfigSchema,
    GoogleDriveOAuthInternetAccountModelFactory,
  ),
]

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
    for (const makeAccountType of internetAccountTypes) {
      pluginManager.addInternetAccountType(makeAccountType)
    }
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
