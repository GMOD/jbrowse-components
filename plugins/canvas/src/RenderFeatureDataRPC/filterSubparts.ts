import { SimpleFeature } from '@jbrowse/core/util'

import { featureType, getSubfeatures, isCDS, isExon, isUTR } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

function utrType(strand: number, isFivePrime: boolean) {
  if (strand > 0) {
    return isFivePrime ? 'five_prime_UTR' : 'three_prime_UTR'
  }
  if (strand < 0) {
    return isFivePrime ? 'three_prime_UTR' : 'five_prime_UTR'
  }
  return 'UTR'
}

function makeUTRs(parent: Feature, subs: Feature[]) {
  const subparts = [...subs]

  let codeStart = Number.POSITIVE_INFINITY
  let codeEnd = Number.NEGATIVE_INFINITY

  for (const sub of subparts) {
    if (isCDS(sub)) {
      const start = sub.get('start')
      const end = sub.get('end')
      if (start < codeStart) {
        codeStart = start
      }
      if (end > codeEnd) {
        codeEnd = end
      }
    }
  }

  if (codeStart === Number.POSITIVE_INFINITY) {
    return subparts
  }

  const parentStart = parent.get('start')
  const parentEnd = parent.get('end')
  const parentStrand = parent.get('strand') ?? 0
  const parentRefName = parent.get('refName')

  // A synthesized UTR carries the `parent` handle so anything reaching up from
  // the box it paints — a `feature.parent` jexl, the itemRgb walk — finds the
  // transcript, rather than painting default between exons that took a color.
  const impliedUTR = (
    id: string,
    start: number,
    end: number,
    isFivePrime: boolean,
  ) =>
    new SimpleFeature({
      id,
      data: {
        refName: parentRefName,
        start,
        end,
        strand: parentStrand,
        type: utrType(parentStrand, isFivePrime),
      },
      parent,
    })

  // Snapshot the exons before pushing, so the loop below never visits the UTRs
  // it synthesizes.
  const exons = subparts.filter(isExon)

  // On a CDS-only transcript the parent bounds are the only evidence for coding
  // overhang. Where exons exist they are the authority instead: a parent-bounds
  // UTR would invent one over an untranscribed region whenever the transcript's
  // bounds overhang its exon union, which malformed but real GFF does.
  if (exons.length === 0) {
    if (parentStart < codeStart) {
      subparts.push(
        impliedUTR(`${parent.id()}-utr-left`, parentStart, codeStart, true),
      )
    }
    if (parentEnd > codeEnd) {
      subparts.push(
        impliedUTR(`${parent.id()}-utr-right`, codeEnd, parentEnd, false),
      )
    }
    return subparts
  }

  for (const sub of exons) {
    const exonStart = sub.get('start')
    const exonEnd = sub.get('end')
    if (exonStart < codeStart) {
      subparts.push(
        impliedUTR(
          `${sub.id()}-utr`,
          exonStart,
          Math.min(exonEnd, codeStart),
          true,
        ),
      )
    }
    if (exonEnd > codeEnd) {
      subparts.push(
        impliedUTR(
          `${sub.id()}-utr2`,
          Math.max(exonStart, codeEnd),
          exonEnd,
          false,
        ),
      )
    }
  }

  return subparts
}

// The slot is one string for the whole track and this runs once per
// transcript, so the split is kept for as long as the string stays the same.
let allowedSubParts: { slot: string; types: Set<string> } | undefined

function allowedSubPartTypes(subParts: string) {
  if (allowedSubParts?.slot !== subParts) {
    allowedSubParts = {
      slot: subParts,
      types: new Set(subParts.split(',').map(t => t.trim().toLowerCase())),
    }
  }
  return allowedSubParts.types
}

export function getSubparts(f: Feature, config: DisplayConfig) {
  let c = getSubfeatures(f)
  if (c.length === 0) {
    return []
  }
  // Only the processed-transcript glyph reaches here, so every feature is a
  // coding transcript. Gated on the real UTR rows because makeUTRs would
  // otherwise push a second, derived set on top of them.
  if (config.impliedUTRs && !c.some(isUTR)) {
    c = makeUTRs(f, c)
  }
  const allowedTypes = allowedSubPartTypes(config.subParts)
  return c.filter(child => allowedTypes.has(featureType(child).toLowerCase()))
}
