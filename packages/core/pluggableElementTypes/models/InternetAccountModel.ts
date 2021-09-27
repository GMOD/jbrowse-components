import { Instance, types } from 'mobx-state-tree'
import { getConf } from '../../configuration'
import { RemoteFileWithRangeCache } from '../../util/io'
import { ElementId } from '../../util/types/mst'
import { GenericFilehandle } from 'generic-filehandle'
import {
  FileLocation,
  UriLocation,
  AnyReactComponentType,
} from '@jbrowse/core/util/types'

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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handlesLocation(location: FileLocation): boolean {
      return false
    },
  }))
  .actions(self => ({
    openLocation(location: UriLocation): GenericFilehandle {
      return new RemoteFileWithRangeCache(String(location.uri))
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getPreAuthorizationInformation(location: UriLocation) {
      return { internetAccountType: self.type }
    },
  }))

export type BaseInternetAccountStateModel = typeof InternetAccount
export type BaseInternetAccountModel = Instance<BaseInternetAccountStateModel>
