/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Instance, types } from 'mobx-state-tree'
import { getConf, readConfObject } from '../../configuration'
import { ElementId } from '../../util/types/mst'
import { GenericFilehandle, RemoteFile } from 'generic-filehandle'
import { FileLocation } from '@jbrowse/core/util/types'

export const InternetAccount = types
  .model('InternetAccount', {
    id: ElementId,
    type: types.string,
  })
  .volatile(() => ({
    loggedIn: false,
    internetAccountMap: {},
  }))
  .views(self => ({
    get name() {
      return getConf(self, 'name')
    },

    get internetAccountId() {
      return getConf(self, 'internetAccountId')
    },

    get accountConfig() {
      // @ts-ignore
      return readConfObject(self.configuration)
    },

    handlesLocation(location: FileLocation): boolean {
      return true
    },
  }))
  .actions(self => ({
    openLocation(location: FileLocation): GenericFilehandle {
      return new RemoteFile(String(location))
    },
    setLoggedIn(bool: boolean) {
      self.loggedIn = bool
    },
    handleRpcMethodCall(
      location: FileLocation,
      map: Record<string, string>,
      args: {},
    ) {
      return this.openLocation(location)
    },
  }))

export type BaseInternetAccountStateModel = typeof InternetAccount
export type BaseInternetAccountModel = Instance<BaseInternetAccountStateModel>
