import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { getRoot, types } from '@jbrowse/mobx-state-tree'

import { HTTPBasicLoginForm } from './HTTPBasicLoginForm.tsx'
import { validateTokenWithHEAD } from '../util.ts'

import type {
  HTTPBasicInternetAccountConfig,
  HTTPBasicInternetAccountConfigModel,
} from './configSchema.ts'
import type { AbstractSessionModel, UriLocation } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

// internet accounts live on the root model (a sibling of session), so read
// session off the root rather than walking up via getSession
interface RootWithSession {
  session: AbstractSessionModel
}

/**
 * #stateModel HTTPBasicInternetAccount
 */
const stateModelFactory = (
  configSchema: HTTPBasicInternetAccountConfigModel,
) => {
  return InternetAccount.named('HTTPBasicInternetAccount')
    .props({
      /**
       * #property
       */
      type: types.literal('HTTPBasicInternetAccount'),
      /**
       * #property
       */
      configuration: ConfigurationReference(configSchema),
    })
    .views(self => ({
      // typed config accessor; see OAuthModel for why reads go through this
      get conf(): HTTPBasicInternetAccountConfig {
        return self.configuration
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get validateWithHEAD() {
        return readConfObject(self.conf, 'validateWithHEAD')
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      getTokenFromUser(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ) {
        const { session } = getRoot<RootWithSession>(self)
        session.queueDialog((doneCallback: () => void) => [
          HTTPBasicLoginForm,
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
      /**
       * #action
       */
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
export type HTTPBasicStateModel = ReturnType<typeof stateModelFactory>
export type HTTPBasicModel = Instance<HTTPBasicStateModel>
