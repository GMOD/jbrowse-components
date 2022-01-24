import React from 'react'
import { Instance, types } from 'mobx-state-tree'
import { getConf } from '../../configuration'
import { RemoteFileWithRangeCache } from '../../util/io'
import { ElementId } from '../../util/types/mst'
import {
  FileLocation,
  UriLocation,
  AnyReactComponentType,
} from '../../util/types'

export const InternetAccount = types
  .model('InternetAccount', {
    id: ElementId,
    type: types.string,
  })
  .views(self => ({
    get name() {
      return getConf(self, 'name')
    },
    get internetAccountId() {
      return getConf(self, 'internetAccountId')
    },
    get tokenType() {
      return getConf(self, 'tokenType')
    },
    get accountConfig() {
      return getConf(self)
    },
    get toggleContents(): React.ReactNode {
      return null
    },
    get SelectorComponent(): AnyReactComponentType | undefined {
      return undefined
    },
    get selectorLabel(): string | undefined {
      return undefined
    },

    handlesLocation(location: FileLocation): boolean {
      return false
    },
  }))
  .actions(self => ({
    openLocation(location: UriLocation) {
      return new RemoteFileWithRangeCache(String(location.uri))
    },
    async getPreAuthorizationInformation(location: UriLocation) {
      return { internetAccountType: self.type }
    },
  }))

export type BaseInternetAccountStateModel = typeof InternetAccount
export type BaseInternetAccountModel = Instance<BaseInternetAccountStateModel>
