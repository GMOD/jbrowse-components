import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { PairwiseAdapterBase } from '../PairwiseAdapterBase.ts'
import { PifFile } from '../PifFile.ts'
import { makeIndexedSyntenyFeature, resolveCoarseTier } from '../util.ts'

import type { PairwiseIndexedPAFAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// PIF indexes each line by perspective: a 'q' prefix means indexed by query
// coordinates (drawn when viewing the query), 't' means indexed by target
// coordinates. Uppercase T/Q are the optional coarse no-CIGAR tier (see
// resolveCoarseTier). pickPifPrefix chooses the perspective letter for the fine
// tier and upper-cases it when the coarse tier should be served.
export function pickPifPrefix({
  flip,
  hasCoarseTier,
  lodMode,
}: {
  flip: boolean
  hasCoarseTier: boolean
  lodMode?: BaseOptions['lodMode']
}) {
  const fineLetter = flip ? 'q' : 't'
  return resolveCoarseTier({ hasCoarseTier, lodMode })
    ? fineLetter.toUpperCase()
    : fineLetter
}

export default class PairwiseIndexedPAFAdapter extends PairwiseAdapterBase<PairwiseIndexedPAFAdapterConfig> {
  private pif = new PifFile(this)

  getHeader(opts?: BaseOptions) {
    return this.pif.getHeader(opts)
  }

  async getRefNames(opts: BaseOptions = {}) {
    const side = this.sideFor(opts.assemblyName)
    if (side === -1) {
      return []
    }
    // Only the fine tier here, so a file that also carries the coarse T/Q tier
    // does not report every chrom twice.
    const letter = side === 0 ? 'q' : 't'
    const names = await this.pif.refSeqNames(opts)
    return names.filter(n => n.startsWith(letter)).map(n => n.slice(1))
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    const { statusCallback, stopToken } = opts
    return ObservableCreate<Feature>(async observer => {
      const { assemblyName } = query

      const side = this.sideFor(assemblyName)
      if (side === -1) {
        console.warn(`${assemblyName} not found in this adapter`)
        observer.complete()
        return
      }

      // flip=true when viewing from query assembly perspective
      // flip=false when viewing from target assembly perspective
      const flip = side === 0

      const letter = pickPifPrefix({
        flip,
        hasCoarseTier: await this.pif.hasCoarseTier(opts),
        lodMode: opts.lodMode,
      })

      const mateAssemblyName = this.mateAssemblyName(side)

      await this.pif.readLines({
        seqid: letter + query.refName,
        start: query.start,
        end: query.end,
        statusCallback,
        stopTokenCheck: createStopTokenChecker(stopToken),
        lineCallback: (parsed, fileOffset) => {
          observer.next(
            makeIndexedSyntenyFeature({
              line: parsed,
              fileOffset,
              assemblyName,
              refName: parsed.indexedRefName,
              mate: {
                start: parsed.mateStart,
                end: parsed.mateEnd,
                refName: parsed.mateName,
                assemblyName: mateAssemblyName,
              },
            }),
          )
        },
      })

      observer.complete()
    })
  }
}
