import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { getGenotypeMatrix } from './getGenotypeMatrix'

import type { Source } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'

interface Args {
  adapterConfig: AnyConfigurationModel
  stopToken?: string
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx: number
  sources: Source[]
  minorAlleleFrequencyFilter: number
}
export class MultiVariantGetGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantGetGenotypeMatrix'

  async execute(args: Args, rpcDriverClassName: string) {
    return getGenotypeMatrix({
      pluginManager: this.pluginManager,
      args: await this.deserializeArguments(args, rpcDriverClassName),
    })
  }
}
