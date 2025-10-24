import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { detectSimplexModifications } from '../../ModificationParser/detectSimplexModifications'
import { getModTypes } from '../../ModificationParser/getModTypes'
import { getTagAlt } from '../../util'
import PileupBaseRPC from '../base'

import type { ModificationType } from '../../shared/types'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

/**
 * RPC method that collects all unique modifications from alignment features
 * and detects which are simplex (single-strand) vs duplex (both strands).
 *
 * For example:
 * - C+m without G-m → simplex
 * - A+a with T-a → duplex (6mA on both strands)
 *
 * Returns both the modifications for display and the simplex list for
 * correct detectable count calculations in the renderer.
 */
export default class PileupGetVisibleModifications extends PileupBaseRPC {
  name = 'PileupGetVisibleModifications'

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: string
      headers?: Record<string, string>
      regions: Region[]
      sessionId: string
      tag: string
    },
    rpcDriver: string,
  ) {
    const deserializeArguments = await this.deserializeArguments(
      args,
      rpcDriver,
    )
    const { adapterConfig, sessionId, regions } = deserializeArguments
    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const featuresArray = await firstValueFrom(
      dataAdapter
        .getFeaturesInMultipleRegions(regions, deserializeArguments)
        .pipe(toArray()),
    )

    // Collect all unique base+strand+type combinations for simplex detection
    // Use a compound key to ensure we capture both A+a and T-a separately
    const uniqueModifications = new Map<string, ModificationType>()
    for (const feat of featuresArray) {
      const mmTag = getTagAlt(feat, 'MM', 'Mm')
      for (const mod of getModTypes(typeof mmTag === 'string' ? mmTag : '')) {
        const key = `${mod.base}${mod.strand}${mod.type}`
        if (!uniqueModifications.has(key)) {
          uniqueModifications.set(key, mod)
        }
      }
    }

    const modifications = [...uniqueModifications.values()]
    const simplexModifications = detectSimplexModifications(modifications)

    // For visibleModifications display, we only need one entry per type
    // (but we needed all of them for simplex detection above)
    const modificationsForDisplay = new Map<string, ModificationType>()
    for (const mod of modifications) {
      if (!modificationsForDisplay.has(mod.type)) {
        modificationsForDisplay.set(mod.type, mod)
      }
    }

    return {
      modifications: [...modificationsForDisplay.values()],
      simplexModifications: [...simplexModifications],
    }
  }
}
