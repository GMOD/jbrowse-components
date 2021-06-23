import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'
import InternetAccountType from '@jbrowse/core/pluggableElementTypes/InternetAccountType'
import {
  configSchemaFactory as OAuthConfigSchemaFactory,
  modelFactory as OAuthInternetAccountModelFactory,
} from './OAuthModel'

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
  }
}
