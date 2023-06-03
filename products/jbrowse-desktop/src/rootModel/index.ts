import { types, Instance, IAnyType } from 'mobx-state-tree'
import makeWorkerInstance from '../makeWorkerInstance'
import assemblyConfigSchemaF, {
  BaseAssemblyConfigSchema,
} from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
} from '@jbrowse/product-core'
import { HistoryManagementMixin, RootAppMenuMixin } from '@jbrowse/app-core'

// locals
import jobsModelFactory from '../indexJobsModel'
import JBrowseDesktop from '../jbrowseModel'
import { DesktopMenusMixin } from './Menus'
import { DesktopSessionManagementMixin, getSaveSession } from './Sessions'
import packageJSON from '../../package.json'

type SessionModelFactory = (args: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) => IAnyType

/**
 * #stateModel JBrowseDesktopRootModel
 * #category root
 * composed of
 * - BaseRootModel
 * - InternetAccountsMixin
 * - DesktopMenuMixin
 * - DesktopSessionManagementMixin
 * - HistoryManagementMixin
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
      jobsManager: types.maybe(JobsManager),
    })
    .volatile(self => ({
      version: packageJSON.version,
      adminMode: true,
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
