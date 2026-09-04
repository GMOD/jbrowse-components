import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { PairwiseAdapterBase } from '../PairwiseAdapterBase.ts'
import { PifFile } from '../PifFile.ts'
import {
  coarseRowsAreBounded,
  makeIndexedSyntenyFeature,
  resolveCoarseTier,
} from '../util.ts'

import type { PairwiseIndexedPAFAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// PIF indexes each line by perspective: a 'q' prefix means indexed by query
// coordinates (drawn when viewing the query), 't' means indexed by target
// coordinates. Uppercase T/Q are the optional coarse tier, whose CIGAR is
// folded to its large indels (see resolveCoarseTier). pickPifPrefix chooses the
// perspective letter for the fine tier and upper-cases it when the coarse tier
// should be served.
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
    return this.pif.info(opts)
  }

  async getRefNames(opts: BaseOptions = {}) {
    const sides = this.facingSides(opts.assemblyName)
    if (sides.length === 0) {
      return []
    }
    // Only the fine tier here, so a file that also carries the coarse T/Q tier
    // does not report every chrom twice.
    const letters = sides.map(side => (side === 0 ? 'q' : 't'))
    const names = await this.pif.refSeqNames(opts)
    return [
      ...new Set(
        names
          .filter(n => letters.some(letter => n.startsWith(letter)))
          .map(n => n.slice(1)),
      ),
    ]
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    const { statusCallback, stopToken } = opts
    return ObservableCreate<Feature>(async observer => {
      const { assemblyName } = query

      const sides = this.queriedSides(assemblyName)

      const hasCoarseTier = await this.pif.hasCoarseTier(opts)
      const boundedCoarseRows = coarseRowsAreBounded(await this.pif.meta(opts))
      const stopTokenCheck = createStopTokenChecker(stopToken)
      const notYetEmitted = this.createSideDedupe(sides)

      // Both sides only for a self-alignment: PIF files the two perspectives of
      // a row under separate q/t seqids, so one assembly named on both sides has
      // its contig indexed under both letters.
      for (const side of sides) {
        // flip=true when viewing from query assembly perspective
        // flip=false when viewing from target assembly perspective
        const flip = side === 0

        const letter = pickPifPrefix({
          flip,
          hasCoarseTier,
          lodMode: opts.lodMode,
        })

        const mateAssemblyName = this.mateAssemblyName(side)

        await this.pif.readLines({
          seqid: letter + query.refName,
          start: query.start,
          end: query.end,
          statusCallback,
          stopTokenCheck,
          lineCallback: (parsed, fileOffset) => {
            if (
              notYetEmitted({
                refName: parsed.indexedRefName,
                start: parsed.indexedStart,
                end: parsed.indexedEnd,
                strand: parsed.strand,
                mateRefName: parsed.mateName,
                mateStart: parsed.mateStart,
                mateEnd: parsed.mateEnd,
              })
            ) {
              observer.next(
                makeIndexedSyntenyFeature({
                  line: parsed,
                  fileOffset,
                  assemblyName,
                  boundedCoarseRows,
                  refName: parsed.indexedRefName,
                  mate: {
                    start: parsed.mateStart,
                    end: parsed.mateEnd,
                    refName: parsed.mateName,
                    assemblyName: mateAssemblyName,
                  },
                }),
              )
            }
          },
        })
      }

      observer.complete()
    })
  }
}
