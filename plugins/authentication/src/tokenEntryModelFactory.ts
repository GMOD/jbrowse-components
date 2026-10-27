import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'

import { getAccountSession, getResponseError, proveToken } from './util.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { UriLocation } from '@jbrowse/core/util/types'
import type React from 'react'

type TokenEntryForm = React.FC<{
  internetAccountId: string
  handleClose: (token?: string) => void
}>

/**
 * #stateModel TokenEntryInternetAccount
 * Shared base for internet accounts whose token the user supplies through a
 * dialog (HTTP Basic, external token). Such accounts differ in their `type`,
 * which also names the model, and the dialog form that collects the token,
 * both passed here. The base is not registered itself; see HTTPBasicInternetAccount
 * and ExternalTokenInternetAccount.
 */
export function tokenEntryModelFactory<Type extends string>(
  typeName: Type,
  configSchema: AnyConfigurationSchemaType,
  LoginForm: TokenEntryForm,
) {
  return InternetAccount.named(typeName)
    .props({
      /**
       * #property
       */
      type: types.literal(typeName),
      /**
       * #property
       */
      configuration: ConfigurationReference(configSchema),
    })
    .views(self => ({
      /**
       * #getter
       * validate the token with a HEAD request before it is used
       */
      get validateWithHEAD(): boolean {
        return getConf(self, 'validateWithHEAD')
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Prompt the user for a token via the account's dialog form, resolving
       * with the entered token or rejecting if the user cancels.
       */
      getTokenFromUser(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ) {
        const session = getAccountSession(self)
        if (!session) {
          throw new Error(
            `Internet account ${self.internetAccountId} has no session to ask for a credential in`,
          )
        }
        session.queueDialog((doneCallback: () => void) => [
          LoginForm,
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
       * Optionally validate the token with a HEAD request before use, per the
       * `validateWithHEAD` config slot. Only a 401 drops the token: there is
       * nothing to renew it with, so the next read re-opens the dialog.
       */
      async validateToken(token: string, location: UriLocation) {
        return self.validateWithHEAD
          ? proveToken({
              account: self,
              token,
              probe: probeToken =>
                fetch(
                  location.uri,
                  self.addAuthHeaderToInit({ method: 'HEAD' }, probeToken),
                ),
              describeError: (response, reason) =>
                getResponseError({ response, reason }),
            })
          : token
      },
    }))
}
