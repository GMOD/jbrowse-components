import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { type Region, groupBy } from '@jbrowse/core/util'
import { firstValueFrom, toArray } from 'rxjs'

import type { Source } from '../util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

interface Args {
  adapterConfig: AnyConfigurationModel
  stopToken?: string
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx: number
  sources: Source[]
}
export class MultiWiggleGetScoreMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiWiggleGetScoreMatrix'

  async execute(args: Args, rpcDriverClassName: string) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { sources, regions, adapterConfig, sessionId, bpPerPx } =
      deserializedArgs
    const adapter = await getAdapter(pm, sessionId, adapterConfig)
    const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

    const r0 = regions[0]!
    const r0len = r0.end - r0.start
    const w = Math.floor(r0len / bpPerPx)
    const feats = await firstValueFrom(
      dataAdapter.getFeatures(r0, deserializedArgs).pipe(toArray()),
    )

    const groups = groupBy(feats, f => f.get('source'))
    const rows = {} as Record<string, { name: string; scores: string[] }>

    for (const source of sources) {
      const { name } = source
      const features = groups[name] || []

      const arr = new Array(w).fill(0)
      for (const feat of features) {
        const fstart = feat.get('start')
        const fend = feat.get('end')
        const score = feat.get('score')
        for (let i = fstart; i < fend; i += bpPerPx) {
          const x = Math.floor((i - r0.start) / bpPerPx)
          if (x >= 0 && x < w) {
            arr[x] ||= score
          }
        }
      }
      rows[name] = { name, scores: arr }
    }

    return rows
  }
}
