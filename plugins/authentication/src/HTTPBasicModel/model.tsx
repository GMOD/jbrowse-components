import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { getRoot, types } from '@jbrowse/mobx-state-tree'

import { HTTPBasicLoginForm } from './HTTPBasicLoginForm.tsx'
import { validateTokenWithHEAD } from '../util.ts'

import type { HTTPBasicInternetAccountConfigModel } from './configSchema.ts'
import type { UriLocation } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
      /**
       * #getter
       */
      get validateWithHEAD(): boolean {
        return getConf(self, 'validateWithHEAD')
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
        const { session } = getRoot<any>(self)
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
          ? validateTokenWithHEAD(token, location, (i, t) =>
              self.addAuthHeaderToInit(i, t),
            )
          : token
      },
    }))
}

export default stateModelFactory
export type HTTPBasicStateModel = ReturnType<typeof stateModelFactory>
export type HTTPBasicModel = Instance<HTTPBasicStateModel>
