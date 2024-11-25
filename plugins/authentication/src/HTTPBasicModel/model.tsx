import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { types, getRoot } from 'mobx-state-tree'

// locals
import { HTTPBasicLoginForm } from './HTTPBasicLoginForm'
import { getResponseError } from '../util'
import type { HTTPBasicInternetAccountConfigModel } from './configSchema'
import type { UriLocation } from '@jbrowse/core/util/types'
import type { Instance } from 'mobx-state-tree'

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
            handleClose: (token: string) => {
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
        if (!self.validateWithHEAD) {
          return token
        }
        const newInit = self.addAuthHeaderToInit({ method: 'HEAD' }, token)
        const response = await fetch(location.uri, newInit)
        if (!response.ok) {
          throw new Error(
            await getResponseError({
              response,
              reason: 'Error validating token',
            }),
          )
        }
        return token
      },
    }))
}

export default stateModelFactory
export type HTTPBasicStateModel = ReturnType<typeof stateModelFactory>
export type HTTPBasicModel = Instance<HTTPBasicStateModel>
