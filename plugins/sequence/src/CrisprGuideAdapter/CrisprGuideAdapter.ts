import {
  IUPAC_MOTIF_REGEX,
  iupacToRegex,
  revcom,
  reverseComplementIupac,
} from '@jbrowse/core/util'

import { ReferenceScanAdapter } from '../ReferenceScanAdapter.ts'
import { guideQuality, placeGuide } from './guideUtils.ts'

import type { ScanWindow } from '../ReferenceScanAdapter.ts'
import type { CrisprGuideAdapterConfig } from './configSchema.ts'

const ACGT_ONLY = /^[acgt]+$/i

export default class CrisprGuideAdapter extends ReferenceScanAdapter<CrisprGuideAdapterConfig> {
  protected scanPadding() {
    return this.getConf('guideLength') + this.getConf('pam').length
  }

  protected scan({ query, residues, windowStart, emit }: ScanWindow) {
    const pam = this.getConf('pam')
    // A hand-written config skips the panel's check. Unchecked, an empty PAM
    // puts a guide on every base and a non-IUPAC letter matches nothing.
    if (!IUPAC_MOTIF_REGEX.test(pam)) {
      throw new Error(
        `Invalid PAM "${pam}": expected IUPAC nucleotide codes, e.g. NGG`,
      )
    }
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
        const guideRaw = strand === 1 ? protoPlus : revcom(protoPlus)
        const pamRaw = strand === 1 ? pamPlus : revcom(pamPlus)
        // the PAM cannot match an assembly gap's N, but the protospacer can
        if (!ACGT_ONLY.test(guideRaw)) {
          continue
        }
        // lowercase is the reference's soft-masking: the guide lies in a
        // repeat. Reported as a field, since guideSeq is uppercased for
        // copying into an order form.
        const softMasked = guideRaw !== guideRaw.toUpperCase()
        const guideSeq = guideRaw.toUpperCase()
        const pamSeq = pamRaw.toUpperCase()
        const { gcPercent, hasPolyT } = guideQuality(guideSeq)
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
          softMasked,
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
