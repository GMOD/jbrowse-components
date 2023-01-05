import { AnyConfigurationModel } from '../configuration'
import jsonStableStringify from 'json-stable-stringify'
import { BaseRefNameAliasAdapter } from '../data_adapters/BaseAdapter'
import PluginManager from '../PluginManager'
import { BasicRegion } from './loadRefNameMap'

export type RefNameAliases = Record<string, string>

export interface BaseOptions {
  signal?: AbortSignal
  sessionId: string
  statusCallback?: Function
}

export async function getRefNameAliases(
  config: AnyConfigurationModel,
  pm: PluginManager,
  signal?: AbortSignal,
) {
  const type = pm.getAdapterType(config.type)
  const CLASS = await type.getAdapterClass()
  const adapter = new CLASS(config, undefined, pm) as BaseRefNameAliasAdapter
  return adapter.getRefNameAliases({ signal })
}

export async function getCytobands(
  config: AnyConfigurationModel,
  pm: PluginManager,
) {
  const type = pm.getAdapterType(config.type)
  const CLASS = await type.getAdapterClass()
  const adapter = new CLASS(config, undefined, pm)

  // @ts-expect-error
  return adapter.getData()
}

export async function getAssemblyRegions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assembly: any,
  adapterConfig: AnyConfigurationModel,
  signal?: AbortSignal,
): Promise<BasicRegion[]> {
  const sessionId = 'loadRefNames'
  return assembly.rpcManager.call(
    sessionId,
    'CoreGetRegions',
    {
      adapterConfig,
      sessionId,
      signal,
    },
    { timeout: 1000000 },
  )
}

const refNameRegex = new RegExp(
  '[0-9A-Za-z!#$%&+./:;?@^_|~-][0-9A-Za-z!#$%&*+./:;=?@^_|~-]*',
)

// Valid refName pattern from https://samtools.github.io/hts-specs/SAMv1.pdf
export function checkRefName(refName: string) {
  if (!refNameRegex.test(refName)) {
    throw new Error(`Encountered invalid refName: "${refName}"`)
  }
}

export function getAdapterId(adapterConf: unknown) {
  return jsonStableStringify(adapterConf)
}
