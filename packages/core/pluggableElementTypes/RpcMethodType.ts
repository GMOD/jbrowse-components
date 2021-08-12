import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import { setBlobMap, getBlobMap } from '../util/tracks'
import { searchForLocationObjects, replaceInArgs } from '../util'

import {
  deserializeAbortSignal,
  isRemoteAbortSignal,
  RemoteAbortSignal,
} from '../rpc/remoteAbortSignals'

export type RpcMethodConstructor = new (pm: PluginManager) => RpcMethodType

export default abstract class RpcMethodType extends PluggableElementBase {
  pluginManager: PluginManager

  name = 'UNKNOWN'

  constructor(pluginManager: PluginManager) {
    super({ name: '' })
    this.pluginManager = pluginManager
  }

  async serializeArguments(args: {}, _rpcDriverClassName: string): Promise<{}> {
    const blobMap = getBlobMap()

    // have a general function that searches the whole args object for locations (need to address to see if an object is a location)
    // add to all locations a constant that is called locationType string ex. locationType: 'localPathLocation', a types.literal
    // search for property 'locationType', if an object has that property it is a location object
    // when finds location that is handled by or associated with internetAccount (if internetaccountId is filled it)
    // it wills in the preauthorization, might require it to launch auth (similar to serializeAuthArguments) and fill in information
    // instead of replacing information in the args, filling in information in the location taht you are serializing

    // needs a way for internetaccount to take a preauth location and make a filehandle from it
    const modifiedArgs = JSON.parse(JSON.stringify(args))

    const locationObjects = searchForLocationObjects(modifiedArgs)

    for (const i in locationObjects) {
      if (locationObjects[i].hasOwnProperty('internetAccountId')) {
        // check rootmodel.handlelocations
        await this.serializeNewAuthArguments(modifiedArgs, locationObjects[i])
      }
    }
    return { ...modifiedArgs, blobMap }
  }

  async serializeNewAuthArguments(
    args: {},
    locationObj: { [key: string]: string },
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootModel: any = this.pluginManager.rootModel

    if (locationObj.internetAccountPreAuthorization) {
      throw new Error('PreAuthorization should not exist yet')
    }
    const modifiedPreAuth = await rootModel?.findAppropriateInternetAccount(
      locationObj,
    )

    const newLocationObj = {
      ...locationObj,
      internetAccountPreAuthorization: modifiedPreAuth,
    }

    replaceInArgs(args, locationObj, newLocationObj)
  }

  async deserializeArguments<
    SERIALIZED extends {
      signal?: RemoteAbortSignal
      blobMap?: Record<string, File>
    }
  >(serializedArgs: SERIALIZED, _rpcDriverClassName: string) {
    if (serializedArgs.blobMap) {
      setBlobMap(serializedArgs.blobMap)
    }
    const { signal } = serializedArgs
    if (signal && isRemoteAbortSignal(signal)) {
      return { ...serializedArgs, signal: deserializeAbortSignal(signal) }
    }

    return { ...serializedArgs, signal: undefined }
  }

  abstract async execute(
    serializedArgs: unknown,
    rpcDriverClassName: string,
  ): Promise<unknown>

  async serializeReturn(
    originalReturn: unknown,
    _args: unknown,
    _rpcDriverClassName: string,
  ) {
    return originalReturn
  }

  async deserializeReturn(
    serializedReturn: unknown,
    _args: unknown,
    _rpcDriverClassName: string,
  ): Promise<unknown> {
    return serializedReturn
  }
}
