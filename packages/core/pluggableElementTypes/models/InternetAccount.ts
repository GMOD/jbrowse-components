import { reaction } from 'mobx'
import {
  addDisposer,
  cast,
  getParent,
  IAnyType,
  Instance,
  types,
} from 'mobx-state-tree'
import { ElementId } from '../../util/types/mst'
import InternetAccountType from '../InternetAccountType'
import {
  Fetcher,
  FilehandleOptions,
  GenericFilehandle,
  PolyfilledResponse,
  Stats,
  RemoteFile,
} from 'generic-filehandle'

export const MyAccount = types
  .model('MyInternetAccountType', {
    id: ElementId,
    types: types.string,
  })
  .views(self => ({
    handleLocation(location: Location): boolean {
      return true
    },
  }))
  .actions(self => ({
    openLocation(location: Location): GenericFilehandle {
      return new RemoteFile(String(location))
    },
  }))
