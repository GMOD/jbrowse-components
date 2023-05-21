import { types, Instance, IAnyType } from 'mobx-state-tree'
import makeWorkerInstance from '../makeWorkerInstance'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
} from '@jbrowse/product-core'
import { HistoryManagementMixin } from '@jbrowse/app-core'

// locals
import jobsModelFactory from '../indexJobsModel'
import JBrowseDesktop from '../jbrowseModel'
import { DesktopMenusMixin } from './Menus'
import { DesktopSessionManagementMixin } from './Sessions'

type SessionModelFactory = (
  pluginManager: PluginManager,
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
      BaseRootModelFactory({
        pluginManager,
        jbrowseModelType: JBrowseDesktop(pluginManager, assemblyConfigSchema),
        sessionModelType: Session,
        assemblyConfigSchema,
      }),
      InternetAccountsRootModelMixin(pluginManager),
      DesktopMenusMixin(pluginManager),
      DesktopSessionManagementMixin(pluginManager),
      HistoryManagementMixin(),
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
    }))
}

export type DesktopRootModelType = ReturnType<typeof rootModelFactory>
export type DesktopRootModel = Instance<DesktopRootModelType>
