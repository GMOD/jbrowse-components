import {
  getExportSessionMenuItem,
  getImportSessionMenuItem,
  getOpenConnectionMenuItem,
  getOpenTrackMenuItem,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { BaseRootModelFactory } from '@jbrowse/product-core'
import AddIcon from '@mui/icons-material/Add'
import { autorun } from 'mobx'

import jbrowseWebFactory from '../jbrowseModel'
import { version } from '../version'

import type { Menu, MenuAction, SessionModelFactory } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { UriLocation } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel JBrowseReactAppRootModel
 *
 * composed of
 * - [BaseRootModel](../baserootmodel)
 *
 * note: many properties of the root model are available through the session,
 * and we generally prefer using the session model (via e.g. getSession) over
 * the root model (via e.g. getRoot) in plugin code
 */
export default function RootModel({
  pluginManager,
  sessionModelFactory,
  makeWorkerInstance = () => {
    throw new Error('no makeWorkerInstance supplied')
  },
}: {
  pluginManager: PluginManager
  sessionModelFactory: SessionModelFactory
  makeWorkerInstance?: () => Worker
}) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  return types
    .compose(
      BaseRootModelFactory({
        pluginManager,
        jbrowseModelType: jbrowseWebFactory({
          pluginManager,
          assemblyConfigSchema,
        }),
        sessionModelType: sessionModelFactory({
          pluginManager,
          assemblyConfigSchema,
        }),
        assemblyConfigSchema,
      }),
      types.model({
        // InternetAccountsRootModelMixin property
        internetAccounts: types.array(
          pluginManager.pluggableMstType('internet account', 'stateModel'),
        ),
      }),
    )

    .volatile(self => ({
      /**
       * #volatile
       */
      version,
      /**
       * #volatile
       */
      pluginsUpdated: false,
      /**
       * #volatile
       */
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: {
            makeWorkerInstance,
          },
          MainThreadRpcDriver: {},
        },
      ),
      /**
       * #volatile
       */
      textSearchManager: new TextSearchManager(pluginManager),
      /**
       * #volatile
       */
      error: undefined as unknown,
      // RootAppMenuMixin volatile
      mutableMenuActions: [] as MenuAction[],
    }))
    .actions(self => ({
      // InternetAccountsRootModelMixin actions
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
        } catch {
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
        const selectedId = location.internetAccountId
        if (selectedId) {
          const selectedAccount = self.internetAccounts.find(account => {
            return account.internetAccountId === selectedId
          })
          if (selectedAccount) {
            return selectedAccount
          }
        }

        for (const account of self.internetAccounts) {
          const handleResult = account.handlesLocation(location)
          if (handleResult) {
            return account
          }
        }

        return selectedId
          ? this.createEphemeralInternetAccount(selectedId, {}, location.uri)
          : null
      },

      // RootAppMenuMixin actions
      /**
       * #action
       */
      setMenus(newMenus: Menu[]) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'setMenus', newMenus },
        ]
      },
      /**
       * #action
       */
      appendMenu(menuName: string) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendMenu', menuName },
        ]
      },
      /**
       * #action
       */
      insertMenu(menuName: string, position: number) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'insertMenu', menuName, position },
        ]
      },
      /**
       * #action
       */
      appendToMenu(menuName: string, menuItem: MenuItem) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendToMenu', menuName, menuItem },
        ]
      },
      /**
       * #action
       */
      insertInMenu(menuName: string, menuItem: MenuItem, position: number) {
        self.mutableMenuActions.push({
          type: 'insertInMenu',
          menuName,
          menuItem,
          position,
        })
      },
      /**
       * #action
       */
      appendToSubMenu(menuPath: string[], menuItem: MenuItem) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendToSubMenu', menuPath, menuItem },
        ]
      },
      /**
       * #action
       */
      insertInSubMenu(
        menuPath: string[],
        menuItem: MenuItem,
        position: number,
      ) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'insertInSubMenu', menuPath, menuItem, position },
        ]
      },
    }))
    .actions(self => {
      return {
        afterCreate() {
          // InternetAccountsRootModelMixin setup
          addDisposer(
            self,
            autorun(
              function internetAccountsAutorun() {
                for (const internetAccount of self.jbrowse.internetAccounts) {
                  self.initializeInternetAccount(internetAccount)
                }
              },
              { name: 'InternetAccounts' },
            ),
          )

          addDisposer(
            self,
            autorun(
              function pluginsUpdatedAutorun() {
                if (self.pluginsUpdated) {
                  // reload app to get a fresh plugin manager
                  window.location.reload()
                }
              },
              { name: 'PluginsUpdated' },
            ),
          )
        },
        /**
         * #action
         */
        setPluginsUpdated(flag: boolean) {
          self.pluginsUpdated = flag
        },
        /**
         * #action
         */
        setDefaultSession() {
          const { defaultSession } = self.jbrowse
          const { setSession } = self as unknown as {
            setSession: (arg: unknown) => void
          }
          setSession({
            ...defaultSession,
            name: `${defaultSession.name} ${new Date().toLocaleString()}`,
          })
        },
        /**
         * #action
         */
        renameCurrentSession(sessionName: string) {
          const { session } = self
          if (session) {
            const { setSession } = self as unknown as {
              setSession: (arg: unknown) => void
            }
            const snapshot = getSnapshot(session) as Record<string, unknown>
            setSession({
              ...snapshot,
              name: sessionName,
            })
          }
        },

        /**
         * #action
         */
        setError(error?: unknown) {
          self.error = error
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      menus() {
        return processMutableMenuActions(
          [
            {
              label: 'File',
              menuItems: [
                {
                  label: 'New session',
                  icon: AddIcon,
                  onClick: () => {
                    self.setDefaultSession()
                  },
                },
                getImportSessionMenuItem(),
                getExportSessionMenuItem(),
                { type: 'divider' },
                getOpenTrackMenuItem(),
                getOpenConnectionMenuItem(),
              ],
            },
            {
              label: 'Add',
              menuItems: [],
            },
            {
              label: 'Tools',
              menuItems: [],
            },
          ],
          self.mutableMenuActions,
        )
      },
    }))
}

export type WebRootModelType = ReturnType<typeof RootModel>
export type WebRootModel = Instance<WebRootModelType>
