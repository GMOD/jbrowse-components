import type React from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { getRoot, types } from '@jbrowse/mobx-state-tree'

import { validateTokenWithHEAD } from './util.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type {
  AbstractSessionModel,
  UriLocation,
} from '@jbrowse/core/util/types'

// internet accounts live on the root model (a sibling of session), so read
// session off the root rather than walking up via getSession
interface RootWithSession {
  session: AbstractSessionModel
}

type TokenEntryForm = React.FC<{
  internetAccountId: string
  handleClose: (token?: string) => void
}>

/**
 * #stateModel TokenEntryInternetAccount
 * Shared base for internet accounts whose token is supplied by the user through
 * a dialog (HTTP Basic, external token). Such accounts differ only in their
 * discriminating `type` and the dialog form used to collect the token, both
 * passed here. Not registered on its own — see HTTPBasicInternetAccount and
 * ExternalTokenInternetAccount.
 */
export function tokenEntryModelFactory<Type extends string>(
  modelName: string,
  typeName: Type,
  configSchema: AnyConfigurationSchemaType,
  LoginForm: TokenEntryForm,
) {
  return InternetAccount.named(modelName)
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
        const { session } = getRoot<RootWithSession>(self)
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
       * `validateWithHEAD` config slot.
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
