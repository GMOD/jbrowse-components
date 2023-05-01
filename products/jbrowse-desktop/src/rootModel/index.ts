import { types, Instance } from 'mobx-state-tree'
import makeWorkerInstance from '../makeWorkerInstance'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

import { BaseRoot, InternetAccounts } from '@jbrowse/product-core'

// locals
import sessionModelFactory from '../sessionModel'
import jobsModelFactory from '../indexJobsModel'
import JBrowseDesktop from '../jbrowseModel'
import Menus from './Menus'
import SessionManagement from './Sessions'
import { HistoryManagement } from './HistoryManagement'

/**
 * #stateModel JBrowseDesktopRootModel
 * note that many properties of the root model are available through the session, which
 * may be preferable since using getSession() is better relied on than getRoot()
 */
export default function rootModelFactory(pluginManager: PluginManager) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  const Session = sessionModelFactory(pluginManager, assemblyConfigSchema)
  const JobsManager = jobsModelFactory(pluginManager)
  return types
    .compose(
      'JBrowseDesktopRootModel',
      BaseRoot(
        pluginManager,
        JBrowseDesktop(pluginManager, Session, assemblyConfigSchema),
        Session,
        assemblyConfigSchema,
      ),
      InternetAccounts(pluginManager),
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
    }))
}

export type RootModelType = ReturnType<typeof rootModelFactory>
export type RootModel = Instance<RootModelType>
