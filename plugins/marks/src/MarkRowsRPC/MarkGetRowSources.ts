import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export interface ListedSource {
  name: string
  label?: string
  color?: string
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MarkGetRowSources: {
      args: { adapterConfig: Record<string, unknown> }
      return: ListedSource[]
    }
  }
}

// A multi-BigWig lists its files without reading a region, and each feature
// carries its file as `source`; any other adapter's `getSources` scans the
// features the split already read.
export function listsSources(adapter: object) {
  return 'getMultiSourceFeatureArraysMulti' in adapter
}

function text(value: unknown) {
  return typeof value === 'string' && value !== '' ? value : undefined
}

export default class MarkGetRowSources extends RpcMethodType<'MarkGetRowSources'> {
  name = 'MarkGetRowSources' as const

  async execute(args: RpcExecuteArgs<'MarkGetRowSources'>) {
    const dataAdapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager: this.pluginManager,
    })
    if (!listsSources(dataAdapter)) {
      return []
    }
    const sources = await dataAdapter.getSources([], args)
    return sources.map(({ name, label, color }): ListedSource => {
      const ownLabel = text(label)
      const ownColor = text(color)
      return {
        name,
        ...(ownLabel === undefined ? {} : { label: ownLabel }),
        ...(ownColor === undefined ? {} : { color: ownColor }),
      }
    })
  }
}
