import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'
import type { BaseRootModel } from './BaseRootModel'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { UriLocation } from '@jbrowse/core/util'
import type { Instance } from 'mobx-state-tree'

/**
 * #stateModel InternetAccountsMixin
 * #category root
 */
export function InternetAccountsRootModelMixin(pluginManager: PluginManager) {
  return types
    .model({
      /**
       * #property
       */
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),
    })
    .actions(self => ({
      /**
       * #action
       */
      initializeInternetAccount(
        internetAccountConfig: AnyConfigurationModel,
        initialSnapshot = {},
      ) {
        const internetAccountType = pluginManager.getInternetAccountType(
          internetAccountConfig.type,
        )
        if (!internetAccountType) {
          throw new Error(
            `unknown internet account type ${internetAccountConfig.type}`,
          )
        }

        const length = self.internetAccounts.push({
          ...initialSnapshot,
          type: internetAccountConfig.type,
          configuration: internetAccountConfig,
        })
        return self.internetAccounts[length - 1]
      },

      /**
       * #action
       */
      createEphemeralInternetAccount(
        internetAccountId: string,
        initialSnapshot: Record<string, unknown>,
        url: string,
      ) {
        let hostUri: string | undefined

        try {
          hostUri = new URL(url).origin
        } catch (e) {
          // ignore
        }
        const internetAccountSplit = internetAccountId.split('-')
        const configuration = {
          type: internetAccountSplit[0]!,
          internetAccountId: internetAccountId,
          name: internetAccountSplit.slice(1).join('-'),
          description: '',
          domains: hostUri ? [hostUri] : [],
        }
        const type = pluginManager.getInternetAccountType(configuration.type)!
        const internetAccount = type.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        self.internetAccounts.push(internetAccount)
        return internetAccount
      },
      /**
       * #action
       */
      findAppropriateInternetAccount(location: UriLocation) {
        // find the existing account selected from menu
        const selectedId = location.internetAccountId
        if (selectedId) {
          const selectedAccount = self.internetAccounts.find(account => {
            return account.internetAccountId === selectedId
          })
          if (selectedAccount) {
            return selectedAccount
          }
        }

        // if no existing account or not found, try to find working account
        for (const account of self.internetAccounts) {
          const handleResult = account.handlesLocation(location)
          if (handleResult) {
            return account
          }
        }

        // if still no existing account, create ephemeral config to use
        return selectedId
          ? this.createEphemeralInternetAccount(selectedId, {}, location.uri)
          : null
      },
    }))
    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(() => {
            const { jbrowse } = self as typeof self & BaseRootModel
            jbrowse.internetAccounts.forEach(self.initializeInternetAccount)
          }),
        )
      },
    }))
}

export type RootModelWithInternetAccountsType = ReturnType<
  typeof InternetAccountsRootModelMixin
>
export type RootModelWithInternetAccounts =
  Instance<RootModelWithInternetAccountsType>
