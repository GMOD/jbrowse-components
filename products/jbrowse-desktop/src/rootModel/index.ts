import { types, Instance, IAnyType } from 'mobx-state-tree'
import makeWorkerInstance from '../makeWorkerInstance'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

import { RootModel } from '@jbrowse/product-core'

// locals
import jobsModelFactory from '../indexJobsModel'
import JBrowseDesktop from '../jbrowseModel'
import Menus from './Menus'
import SessionManagement from './Sessions'
import { HistoryManagement } from './HistoryManagement'

type SessionModelFactory = (
  pm: PluginManager,
  assemblyConfigSchema: ReturnType<typeof assemblyConfigSchemaFactory>,
) => IAnyType

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
export default function rootModelFactory(
  pluginManager: PluginManager,
  sessionModelFactory: SessionModelFactory,
) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  const Session = sessionModelFactory(pluginManager, assemblyConfigSchema)
  const JobsManager = jobsModelFactory(pluginManager)
  return types
    .compose(
      'JBrowseDesktopRootModel',
      RootModel.BaseRootModel(
        pluginManager,
        JBrowseDesktop(pluginManager, assemblyConfigSchema),
        Session,
        assemblyConfigSchema,
      ),
      RootModel.InternetAccounts(pluginManager),
      Menus(pluginManager),
      SessionManagement(pluginManager),
      HistoryManagement,
    )
    .props({
      /**
       * #property
       */
      jobsManager: types.maybe(JobsManager),
    })
    .volatile(self => ({
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
    }))
}

export type DesktopRootModelType = ReturnType<typeof rootModelFactory>
export type DesktopRootModel = Instance<DesktopRootModelType>
