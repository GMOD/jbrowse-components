import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { getRoot, types } from '@jbrowse/mobx-state-tree'

import { ExternalTokenEntryForm } from './ExternalTokenEntryForm.tsx'
import { validateTokenWithHEAD } from '../util.ts'

import type {
  ExternalTokenInternetAccountConfig,
  ExternalTokenInternetAccountConfigModel,
} from './configSchema.ts'
import type { UriLocation } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

const stateModelFactory = (
  configSchema: ExternalTokenInternetAccountConfigModel,
) => {
  return InternetAccount.named('ExternalTokenInternetAccount')
    .props({
      type: types.literal('ExternalTokenInternetAccount'),
      configuration: ConfigurationReference(configSchema),
    })
    .views(self => ({
      // typed config accessor; see OAuthModel for why reads go through this
      get conf(): ExternalTokenInternetAccountConfig {
        return self.configuration
      },
    }))
    .views(self => ({
      get validateWithHEAD() {
        return readConfObject(self.conf, 'validateWithHEAD')
      },
    }))
    .actions(self => ({
      getTokenFromUser(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ) {
        const { session } = getRoot<any>(self)
        session.queueDialog((doneCallback: () => void) => [
          ExternalTokenEntryForm,
          {
            internetAccountId: self.internetAccountId,
            handleClose: (token?: string) => {
              if (token) {
                resolve(token)
              } else {
                reject(new Error('User cancelled entry'))
              }
              doneCallback()
            },
          },
        ])
      },
      async validateToken(token: string, location: UriLocation) {
        return self.validateWithHEAD
          ? validateTokenWithHEAD(
              token,
              location,
              self.addAuthHeaderToInit({ method: 'HEAD' }, token),
            )
          : token
      },
    }))
}

export default stateModelFactory
export type ExternalTokenStateModel = ReturnType<typeof stateModelFactory>
export type ExternalTokenModel = Instance<ExternalTokenStateModel>
