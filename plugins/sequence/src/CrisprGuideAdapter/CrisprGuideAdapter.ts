import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  SimpleFeature,
  doesIntersect2,
  iupacToRegex,
  revcom,
  reverseComplementIupac,
} from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { getSequenceSubAdapter } from '../getSequenceSubAdapter.ts'
import { guideQuality, placeGuide } from './guideUtils.ts'

import type { CrisprGuideAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class CrisprGuideAdapter extends BaseFeatureDataAdapter<CrisprGuideAdapterConfig> {
  public async configure() {
    return getSequenceSubAdapter(this, this.getConf('sequenceAdapter'))
  }

  public async getRefNames() {
    const adapter = await this.configure()
    return adapter.getRefNames()
  }

  public getFeatures(query: Region, opts: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      const sequenceAdapter = await this.configure()
      const pam = this.getConf('pam')
      const guideLength = this.getConf('guideLength')
      const pamLocation = this.getConf('pamLocation')
      const cutOffset = this.getConf('cutOffset')
      const searchForward = this.getConf('searchForward')
      const searchReverse = this.getConf('searchReverse')

      // a guide's protospacer can extend guideLength+PAM beyond the PAM, so pad
      // the fetch to catch guides whose PAM lies just outside the query region
      const pad = guideLength + pam.length + 5
      const queryStart = Math.max(0, query.start - pad)
      const queryEnd = query.end + pad
      const residues =
        (await sequenceAdapter.getSequence(
          { ...query, start: queryStart, end: queryEnd },
          opts,
        )) ?? ''
      // getSequence clamps to the contig end; anchor bounds on the real length
      const seqEnd = queryStart + residues.length

      const emit = (motif: string, strand: 1 | -1) => {
        // lookahead keeps overlapping PAM matches (a PAM can start at every base)
        const re = new RegExp(`(?=(${iupacToRegex(motif)}))`, 'gi')
        for (const match of residues.matchAll(re)) {
          const placement = placeGuide({
            matchStart: queryStart + match.index,
            pamLength: pam.length,
            guideLength,
            pamLocation,
            cutOffset,
            strand,
          })
          const { featureStart, featureEnd, pamStart, pamEnd, cutSite } =
            placement
          const inBounds = featureStart >= queryStart && featureEnd <= seqEnd
          const intersects = doesIntersect2(
            featureStart,
            featureEnd,
            query.start,
            query.end,
          )
          if (inBounds && intersects) {
            const rel = (c: number) => c - queryStart
            const protoPlus = residues.slice(
              rel(placement.protoStart),
              rel(placement.protoEnd),
            )
            const pamPlus = residues.slice(rel(pamStart), rel(pamEnd))
            const guideSeq = strand === 1 ? protoPlus : revcom(protoPlus)
            const pamSeq = strand === 1 ? pamPlus : revcom(pamPlus)
            const { gcPercent, hasPolyT } = guideQuality(guideSeq)
            const id = `${this.id}-${featureStart}-${strand}`
            observer.next(
              new SimpleFeature({
                uniqueId: id,
                refName: query.refName,
                start: featureStart,
                end: featureEnd,
                strand,
                name: guideSeq,
                type: 'guide_rna',
                guideSeq,
                pam: pamSeq,
                cutSite,
                gcPercent,
                hasPolyT,
                subfeatures: [
                  {
                    uniqueId: `${id}-pam`,
                    refName: query.refName,
                    start: pamStart,
                    end: pamEnd,
                    strand,
                    type: 'PAM',
                  },
                ],
              }),
            )
          }
        }
      }

      if (searchForward) {
        emit(pam, 1)
      }
      if (searchReverse) {
        emit(reverseComplementIupac(pam), -1)
      }
      observer.complete()
    })
  }
}
