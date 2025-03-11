import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { type Region, groupBy } from '@jbrowse/core/util'
import { firstValueFrom, toArray } from 'rxjs'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export class MultiWiggleGetScoreMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiWiggleGetScoreMatrix'

  async execute(
    args: {
      adapterConfig: AnyConfigurationModel
      stopToken?: string
      sessionId: string
      headers?: Record<string, string>
      regions: Region[]
      bpPerPx: number
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { sources, regions, adapterConfig, sessionId, bpPerPx } =
      deserializedArgs
    const adapter = await getAdapter(pm, sessionId, adapterConfig)
    const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter
    const resolution = 2
    const bpScale = bpPerPx / resolution

    const r0 = regions[0]
    const r0len = r0.end - r0.start
    const w = Math.floor(r0len / bpScale)
    const feats = await firstValueFrom(
      dataAdapter.getFeatures(r0, deserializedArgs).pipe(toArray()),
    )

    const groups = groupBy(feats, f => f.get('source'))
    const rows = {} as Record<string, { name: string; scores: string[] }>
    for (const source of sources) {
      const { name } = source
      const features = groups[name] || []
      for (const feat of features) {
        if (!rows[name]) {
          rows[name] = {
            name,
            scores: new Array(w),
          }
        }
        const fstart = feat.get('start')
        const fend = feat.get('end')
        const score = feat.get('score')
        for (let i = fstart; i < fend; i += bpScale) {
          if (i > r0.start && i < r0.end) {
            rows[name].scores[Math.floor((i - r0.start) / bpScale)] ||= score
          }
        }
      }
    }

    return rows
  }
}
