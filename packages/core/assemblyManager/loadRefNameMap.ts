import { BaseOptions, checkRefName, RefNameAliases } from './util'
import RpcManager from '../rpc/RpcManager'
import { when } from '../util'

export interface BasicRegion {
  start: number
  end: number
  refName: string
  assemblyName: string
}

export async function loadRefNameMap(
  assembly: {
    name: string
    regions: BasicRegion[] | undefined
    refNameAliases: RefNameAliases | undefined
    getCanonicalRefName: (arg: string) => string
    rpcManager: RpcManager
  },
  adapterConfig: unknown,
  options: BaseOptions,
  signal?: AbortSignal,
) {
  const { sessionId } = options
  await when(() => !!(assembly.regions && assembly.refNameAliases), {
    signal,
    name: 'when assembly ready',
  })

  const refNames = (await assembly.rpcManager.call(
    sessionId,
    'CoreGetRefNames',
    {
      adapterConfig,
      signal,
      ...options,
    },
    { timeout: 1000000 },
  )) as string[]

  const { refNameAliases } = assembly
  if (!refNameAliases) {
    throw new Error(`error loading assembly ${assembly.name}'s refNameAliases`)
  }

  const refNameMap = Object.fromEntries(
    refNames.map(name => {
      checkRefName(name)
      return [assembly.getCanonicalRefName(name), name]
    }),
  )

  // make the reversed map too
  const reversed = Object.fromEntries(
    Object.entries(refNameMap).map(([canonicalName, adapterName]) => [
      adapterName,
      canonicalName,
    ]),
  )

  return {
    forwardMap: refNameMap,
    reverseMap: reversed,
  }
}
