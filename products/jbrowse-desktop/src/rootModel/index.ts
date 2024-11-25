import { HistoryManagementMixin, RootAppMenuMixin } from '@jbrowse/app-core'
import assemblyConfigSchemaF from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
} from '@jbrowse/product-core'
import { types } from 'mobx-state-tree'
import { createRoot, hydrateRoot } from 'react-dom/client'
import packageJSON from '../../package.json'
import jobsModelFactory from '../indexJobsModel'

// locals
import JBrowseDesktop from '../jbrowseModel'
import makeWorkerInstance from '../makeWorkerInstance'
import { DesktopMenusMixin } from './Menus'
import { DesktopSessionManagementMixin, getSaveSession } from './Sessions'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import type { Instance, IAnyType } from 'mobx-state-tree'

type SessionModelFactory = (args: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) => IAnyType

/**
 * #stateModel JBrowseDesktopRootModel
 * #category root
 * composed of
 * - [BaseRootModel](../baserootmodel)
 * - [InternetAccountsMixin](../internetaccountsmixin)
 * - [DesktopMenusMixin](../desktopmenusmixin)
 * - [DesktopSessionManagementMixin](../desktopsessionmanagementmixin)
 * - [HistoryManagementMixin](../historymanagementmixin)
 * - [RootAppMenuMixin](../rootappmenumixin)
 *
 * note: many properties of the root model are available through the session,
 * and we generally prefer using the session model (via e.g. getSession) over
 * the root model (via e.g. getRoot) in plugin code
 */
export default function rootModelFactory({
  pluginManager,
  sessionModelFactory,
}: {
  pluginManager: PluginManager
  sessionModelFactory: SessionModelFactory
}) {
  const assemblyConfigSchema = assemblyConfigSchemaF(pluginManager)
  const sessionModelType = sessionModelFactory({
    pluginManager,
    assemblyConfigSchema,
  })
  const jbrowseModelType = JBrowseDesktop(pluginManager, assemblyConfigSchema)
  const JobsManager = jobsModelFactory(pluginManager)
  return types
    .compose(
      'JBrowseDesktopRootModel',
      BaseRootModelFactory({
        pluginManager,
        jbrowseModelType,
        sessionModelType,
        assemblyConfigSchema,
      }),
      InternetAccountsRootModelMixin(pluginManager),
      DesktopMenusMixin(pluginManager),
      DesktopSessionManagementMixin(pluginManager),
      HistoryManagementMixin(),
      RootAppMenuMixin(),
    )
    .props({
      /**
       * #property
       */
      jobsManager: types.optional(JobsManager, {}),
    })
    .volatile(self => ({
      version: packageJSON.version,
      adminMode: true,
      hydrateFn: hydrateRoot,
      createRootFn: createRoot,
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: { makeWorkerInstance },
          MainThreadRpcDriver: {},
        },
      ),
      openNewSessionCallback: async (_path: string) => {
        console.error('openNewSessionCallback unimplemented')
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setOpenNewSessionCallback(cb: (arg: string) => Promise<void>) {
        self.openNewSessionCallback = cb
      },
      /**
       * #action
       */
      async setPluginsUpdated() {
        const root = self as DesktopRootModel
        if (root.session) {
          await root.saveSession(getSaveSession(root))
        }
        await root.openNewSessionCallback(root.sessionPath)
      },
    }))
}

export type DesktopRootModelType = ReturnType<typeof rootModelFactory>
export type DesktopRootModel = Instance<DesktopRootModelType>
