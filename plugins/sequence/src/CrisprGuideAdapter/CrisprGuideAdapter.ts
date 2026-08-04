import {
  iupacToRegex,
  revcom,
  reverseComplementIupac,
} from '@jbrowse/core/util'

import { ReferenceScanAdapter } from '../ReferenceScanAdapter.ts'
import { guideQuality, placeGuide } from './guideUtils.ts'

import type { ScanWindow } from '../ReferenceScanAdapter.ts'
import type { CrisprGuideAdapterConfig } from './configSchema.ts'

export default class CrisprGuideAdapter extends ReferenceScanAdapter<CrisprGuideAdapterConfig> {
  protected scanPadding() {
    // a guide's protospacer reaches guideLength+PAM beyond the PAM match, so pad
    // by that much to catch guides whose PAM lies just outside the query
    return this.getConf('guideLength') + this.getConf('pam').length
  }

  protected scan({ query, residues, windowStart, emit }: ScanWindow) {
    const pam = this.getConf('pam')
    const guideLength = this.getConf('guideLength')
    const pamLocation = this.getConf('pamLocation')
    const cutOffset = this.getConf('cutOffset')
    const cutOffsetBottom = this.getConf('cutOffsetBottom')
    const searchForward = this.getConf('searchForward')
    const searchReverse = this.getConf('searchReverse')
    const minGcPercent = this.getConf('minGcPercent')
    const maxGcPercent = this.getConf('maxGcPercent')
    const excludePolyT = this.getConf('excludePolyT')

    const emitGuides = (motif: string, strand: 1 | -1) => {
      // lookahead keeps overlapping PAM matches (a PAM can start at every base)
      const re = new RegExp(`(?=(${iupacToRegex(motif)}))`, 'gi')
      for (const match of residues.matchAll(re)) {
        const placement = placeGuide({
          matchStart: windowStart + match.index,
          pamLength: pam.length,
          guideLength,
          pamLocation,
          cutOffset,
          cutOffsetBottom,
          strand,
        })
        const { featureStart, featureEnd, pamStart, pamEnd, cutSite } =
          placement
        const rel = (c: number) => c - windowStart
        const protoPlus = residues.slice(
          rel(placement.protoStart),
          rel(placement.protoEnd),
        )
        const pamPlus = residues.slice(rel(pamStart), rel(pamEnd))
        const guideSeq = strand === 1 ? protoPlus : revcom(protoPlus)
        const pamSeq = strand === 1 ? pamPlus : revcom(pamPlus)
        const { gcPercent, hasPolyT } = guideQuality(guideSeq)
        // Sequence-level triage, applied here rather than left to the viewer: a
        // PAM occurs every ~8bp of genome, so an unfiltered track is a solid
        // wall that the display's density guard hides at anything but the
        // tightest zoom. NOT a specificity/off-target score.
        if (
          gcPercent < minGcPercent ||
          gcPercent > maxGcPercent ||
          (excludePolyT && hasPolyT)
        ) {
          continue
        }
        const id = `${this.id}-${featureStart}-${strand}`
        emit({
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
          ...(placement.cutSiteBottom === undefined
            ? {}
            : { cutSiteBottom: placement.cutSiteBottom }),
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
        })
      }
    }

    if (searchForward) {
      emitGuides(pam, 1)
    }
    if (searchReverse) {
      emitGuides(reverseComplementIupac(pam), -1)
    }
  }
}
