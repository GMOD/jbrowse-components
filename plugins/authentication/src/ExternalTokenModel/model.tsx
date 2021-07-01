// will move later, just putting here tempimport React from 'react'
import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getRoot } from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { ExternalTokenInternetAccountConfigModel } from './configSchema'
import { addDisposer, getSnapshot, Instance, types } from 'mobx-state-tree'

interface Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: ExternalTokenInternetAccountConfigModel,
) => {
  return (
    types
      .compose(
        'ExternalTokenInternetAccount',
        InternetAccount,
        types.model({
          id: 'ExternalToken',
          type: types.literal('ExternalTokenInternetAccount'),
          configuration: ConfigurationReference(configSchema),
        }),
      )
      .volatile(() => ({
        externalToken: '',
        currentTypeAuthorizing: '',
        selected: false,
      }))
      // handleslocation will have to look at config and see what domain it's pointing at
      // i.e if google drive oauth, handlesLocation looks at self.config.endpoint and see if it is the associated endpoint
      // if above returns true then do the oauth flow as openLocation to get the correct headers
      .views(self => ({
        handlesLocation(location?: Location): boolean {
          // this will probably look at something in the config which indicates that it is an OAuth pathway,
          // also look at location, if location is set to need authentication it would reutrn true
          const validDomains = self.accountConfig.validDomains
          return (
            // accountConfig.needsAuthorization &&
            validDomains.length === 0 ||
            validDomains.some((domain: string) =>
              location?.href.includes(domain),
            )
          )
        },
      }))
      .actions(self => ({
        async fetchFile(location: string) {
          if (!location || !self.externalToken) {
            return
          }
          // add a fetch call for gdc adding the token to the header, or place the header into
          // sessionstorage for fetch to use
        },
        async openFieldForExternalToken() {
          // open a dialog box that has a text field for pasting a token
          // something like
          // <DialogBoxExternal setExternalToken={this.setExternalToken}
        },
        setExternalToken(token: string) {
          self.externalToken = token
        },
        async openLocation(location: Location) {
          const startFlow = await this.openFieldForExternalToken()
          return startFlow
        },
      }))
  )
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
