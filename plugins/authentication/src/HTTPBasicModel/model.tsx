import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { UriLocation } from '@jbrowse/core/util/types'
import { Instance, types, getRoot } from 'mobx-state-tree'

// locals
import { HTTPBasicInternetAccountConfigModel } from './configSchema'
import { HTTPBasicLoginForm } from './HTTPBasicLoginForm'
import { getResponseError } from '../util'

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
      configuration: ConfigurationReference(configSchema),

      /**
       * #property
       */
      type: types.literal('HTTPBasicInternetAccount'),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { session } = getRoot<any>(self)
        session.queueDialog((doneCallback: () => void) => [
          HTTPBasicLoginForm,
          {
            handleClose: (token: string) => {
              if (token) {
                resolve(token)
              } else {
                reject(new Error('User cancelled entry'))
              }
              doneCallback()
            },
            internetAccountId: self.internetAccountId,
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
              reason: 'Error validating token',
              response,
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
