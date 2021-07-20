/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Instance, types } from 'mobx-state-tree'
import { getConf, readConfObject } from '../../configuration'
import { MenuItem } from '../../ui'
import { ElementId } from '../../util/types/mst'
import { GenericFilehandle, RemoteFile } from 'generic-filehandle'

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

    handlesLocation(location: Location): boolean {
      return true
    },
  }))
  .actions(self => ({
    openLocation(location: Location): GenericFilehandle {
      return new RemoteFile(String(location))
    },
    setLoggedIn(bool: boolean) {
      self.loggedIn = bool
    },
    getTokensFromStorage() {
      const keyMap: Record<string, string> = {}
      Object.entries(sessionStorage).forEach(entry => {
        const [key, value] = entry
        if (key.includes('token')) {
          keyMap[key.split('-')[0]] = value
        }
      })
      return keyMap
    },
    removeTokenFromStorage(id: string, keyMap: Record<string, string>) {
      const expiredTokenKey = Object.keys(sessionStorage).find(key => {
        return key.split('-')[0] === id
      })
      if (expiredTokenKey) {
        sessionStorage.removeItem(expiredTokenKey)
        delete keyMap[id]
      }
      return keyMap
    },
    setInternetAccountMap(map: { [key: string]: string }) {
      self.internetAccountMap = map
    },
    handleRpcMethodCall(
      location: Location,
      map: Record<string, string>,
      args: {},
    ) {
      return this.openLocation(location)
    },
  }))

export type BaseInternetAccountStateModel = typeof InternetAccount
export type BaseInternetAccountModel = Instance<BaseInternetAccountStateModel>
