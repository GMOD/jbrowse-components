// will move later, just putting here tempimport React from 'react'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation, AuthLocation } from '@jbrowse/core/util/types'
import { HTTPBasicInternetAccountConfigModel } from './configSchema'
import { Instance, types } from 'mobx-state-tree'
import crypto from 'crypto'

interface Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: HTTPBasicInternetAccountConfigModel,
) => {
  return types
    .compose(
      'HTTPBasicInternetAccount',
      InternetAccount,
      types.model({
        id: 'HTTPBasic',
        type: types.literal('HTTPBasicInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      currentTypeAuthorizing: '',
    }))
    .views(self => ({
      get tokenType() {
        return getConf(self, 'tokenType') || 'Basic'
      },
      handlesLocation(location: FileLocation): boolean {
        // this will probably look at something in the config which indicates that it is an OAuth pathway,
        // also look at location, if location is set to need authentication it would reutrn true
        const validDomains = self.accountConfig.validDomains || []
        return validDomains.some((domain: string) =>
          (location as AuthLocation)?.uri.includes(domain),
        )
      },
    }))
    .actions(self => ({
      async openLocation(location: FileLocation) {
        // notes:
        // need a field to enter a username and password
        // this has to be a dialog box with input fields
        // and the input password field needs to have those security settings
        // and able to autofill with lastpass/google
        // will have to resolve the promise in the "Ok" of the dialog box
        // check out https://github.com/GMOD/jbrowse-plugin-apollo/blob/login/src/components/LoginForm.tsx
        // for a simple login form
        // then base64 encode the entry to the form
        // create the auth header such as "Authorization": "Basic base64user:base64pass"
        // and then call the resource
      },
      async handleRpcMethodCall(
        location: FileLocation,
        authenticationInfoMap: Record<string, string>,
        args: {},
      ) {
        await this.openLocation(location)
      },
    }))
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
