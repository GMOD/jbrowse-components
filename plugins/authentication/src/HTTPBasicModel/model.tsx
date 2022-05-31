import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { UriLocation } from '@jbrowse/core/util/types'
import { HTTPBasicInternetAccountConfigModel } from './configSchema'
import { Instance, types, getRoot } from 'mobx-state-tree'

import { HTTPBasicLoginForm } from './HTTPBasicLoginForm'

const stateModelFactory = (
  configSchema: HTTPBasicInternetAccountConfigModel,
) => {
  return types
    .compose(
      'HTTPBasicInternetAccount',
      InternetAccount,
      types.model({
        type: types.literal('HTTPBasicInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      get validateWithHEAD(): boolean {
        return getConf(self, 'validateWithHEAD')
      },
    }))
    .actions(self => ({
      getTokenFromUser(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ) {
        const { session } = getRoot(self)
        session.queueDialog(doneCallback => [
          HTTPBasicLoginForm,
          {
            internetAccountId: self.internetAccountId,
            handleClose: (token: string) => {
              if (token) {
                resolve(token)
              } else {
                reject(new Error('user cancelled entry'))
              }
              doneCallback()
            },
          },
        ])
      },
      async validateToken(token: string, location: UriLocation) {
        if (!self.validateWithHEAD) {
          return token
        }
        const newInit = self.addAuthHeaderToInit({ method: 'HEAD' }, token)
        const response = await fetch(location.uri, newInit)
        if (!response.ok) {
          let errorMessage
          try {
            errorMessage = await response.text()
          } catch (error) {
            errorMessage = ''
          }
          throw new Error(
            `Error validating token — ${response.status} (${
              response.statusText
            })${errorMessage ? ` (${errorMessage})` : ''}`,
          )
        }
        return token
      },
    }))
}

export default stateModelFactory
export type HTTPBasicStateModel = ReturnType<typeof stateModelFactory>
export type HTTPBasicModel = Instance<HTTPBasicStateModel>
