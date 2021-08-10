import PluginManager from '../PluginManager'
import PluggableElementBase from './PluggableElementBase'
import {
  setBlobMap,
  getBlobMap,
  setAuthenticationInfoMap,
} from '../util/tracks'
import { searchOrReplaceInArgs, searchForLocationObjects } from '../util'

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
    const authenticationInfoMap = {}

    // have a general function that searches the whole args object for locations (need to address to see if an object is a location)
    // add to all locations a constant that is called locationType string ex. locationType: 'localPathLocation', a types.literal
    // search for property 'locationType', if an object has that property it is a location object
    // when finds location that is handled by or associated with internetAccount (if internetaccountId is filled it)
    // it wills in the preauthorization, might require it to launch auth (similar to serializeAuthArguments) and fill in information
    // instead of replacing information in the args, filling in information in the location taht you are serializing

    // needs a way for internetaccount to take a preauth location and make a filehandle from it
    console.log('here', args, searchForLocationObjects(args))

    const locationObjects = searchForLocationObjects(args)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    locationObjects.forEach((obj: any) => {
      if (obj.hasOwnProperty('internetAccountId')) {
        // return this.serializeAuthArguments(args, blobMap, authenticationInfoMap)
        // next: need to change serializeautharguments to fill in the preauth object
        return this.serializeNewAuthArguments(
          args,
          blobMap,
          authenticationInfoMap,
          obj,
        )
      }
      return
    })
    // if (
    //   args.hasOwnProperty('adapterConfig') &&
    //   searchOrReplaceInArgs(args, 'internetAccountId')
    // ) {
    //   return this.serializeAuthArguments(args, blobMap, authenticationInfoMap)
    // }
    return { ...args, blobMap, authenticationInfoMap }
  }

  async serializeNewAuthArguments(
    args: {},
    blobMap: { [key: string]: File },
    authenticationInfoMap: Record<string, string>,
    locationObj: { [key: string]: string },
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootModel: any = this.pluginManager.rootModel
    authenticationInfoMap = rootModel?.getAuthenticationInfoMap()

    const modifiedPreAuth = await rootModel?.findAppropriateInternetAccount(
      locationObj,
      authenticationInfoMap,
      args,
    )

    if (typeof modifiedPreAuth === 'object') {
      return { ...args, blobMap, authenticationInfoMap }
    }
  }

  async serializeAuthArguments(
    args: {},
    blobMap: { [key: string]: File },
    authenticationInfoMap: Record<string, string>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootModel: any = this.pluginManager.rootModel
    authenticationInfoMap = rootModel?.getAuthenticationInfoMap()
    const adapterConfig = searchOrReplaceInArgs(args, 'adapterConfig')

    const fileLocation =
      adapterConfig[
        Object.keys(adapterConfig).find(key => {
          return key.toLowerCase().includes('location')
        }) as string
      ]

    const modifiedArgs = await rootModel?.findAppropriateInternetAccount(
      fileLocation,
      authenticationInfoMap,
      args,
    )

    if (typeof modifiedArgs === 'object') {
      authenticationInfoMap = rootModel?.getAuthenticationInfoMap()
      return { ...modifiedArgs, blobMap, authenticationInfoMap }
    } else {
      return { ...args, blobMap, authenticationInfoMap }
    }
  }

  async deserializeArguments<
    SERIALIZED extends {
      signal?: RemoteAbortSignal
      blobMap?: Record<string, File>
      authenticationInfoMap?: Record<string, string>
    }
  >(serializedArgs: SERIALIZED, _rpcDriverClassName: string) {
    if (serializedArgs.blobMap) {
      setBlobMap(serializedArgs.blobMap)
    }
    if (serializedArgs.authenticationInfoMap) {
      setAuthenticationInfoMap(serializedArgs.authenticationInfoMap)
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
