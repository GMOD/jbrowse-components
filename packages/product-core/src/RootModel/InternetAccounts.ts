import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { asRoot } from '../siblingCast.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { UriLocation } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
        self.internetAccounts.push({
          ...initialSnapshot,
          type: internetAccountConfig.type,
          configuration: internetAccountConfig,
        })
        return self.internetAccounts.at(-1)
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
          const urlObj = new URL(url)
          const pathname = urlObj.pathname
          const lastSlash = pathname.lastIndexOf('/')
          const dirPath =
            lastSlash !== -1 ? pathname.slice(0, lastSlash + 1) : '/'
          hostUri = `${urlObj.origin}${dirPath}`
        } catch {
          // ignore
        }
        const internetAccountSplit = internetAccountId.split('-')
        const configuration = {
          type: internetAccountSplit[0]!,
          internetAccountId,
          name: internetAccountSplit.slice(1).join('-'),
          description: '',
          domains: hostUri ? [hostUri] : [],
        }
        self.internetAccounts.push({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        return self.internetAccounts.at(-1)
      },
    }))
    .actions(self => ({
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
          ? self.createEphemeralInternetAccount(selectedId, {}, location.uri)
          : null
      },
    }))
    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(
            function internetAccountsAutorun() {
              const { jbrowse } = asRoot(self)
              for (const internetAccount of jbrowse.internetAccounts) {
                if (
                  !self.internetAccounts.some(
                    a =>
                      a.internetAccountId === internetAccount.internetAccountId,
                  )
                ) {
                  self.initializeInternetAccount(internetAccount)
                }
              }
            },
            { name: 'InternetAccounts' },
          ),
        )
      },
    }))
}

export type RootModelWithInternetAccountsType = ReturnType<
  typeof InternetAccountsRootModelMixin
>
export type RootModelWithInternetAccounts =
  Instance<RootModelWithInternetAccountsType>
