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

  // The `parent` handle is what this helper is for. Anything reaching up from
  // the box it paints — `jexl:feature.parent.dif`, the itemRgb walk in
  // getBoxColor — has to find the transcript from a synthesized UTR too, or
  // those come out the default color between exons that took the callback's.
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

  // Snapshot the exons before pushing: appending to `subparts` while iterating
  // it would otherwise visit the synthesized UTRs (they're skipped only because
  // they aren't exons — a fragile invariant to lean on).
  const exons = subparts.filter(isExon)

  // No exons at all (a CDS-only transcript): the parent transcript bounds are
  // the only evidence for coding overhang, so imply UTRs from parentStart/End.
  // When exons ARE present they are the authority — UTRs come purely from their
  // geometry below, never from parent bounds. Deriving a parent-bounds UTR while
  // exons exist would invent a UTR over an untranscribed region whenever the
  // transcript's bounds overhang its exon union (malformed but real GFF).
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

export function getSubparts(f: Feature, config: DisplayConfig) {
  let c = getSubfeatures(f)
  if (c.length === 0) {
    return []
  }
  const hasUTRs = c.some(isUTR)
  // getSubparts only runs for the processed-transcript glyph, which findGlyph
  // selects structurally (a direct CDS child) — so every feature reaching here
  // is a coding transcript. Synthesize UTRs from the exon/CDS geometry when the
  // transcript carries none explicitly; the global impliedUTRs slot can turn
  // this off. Gated on !hasUTRs because makeUTRs would otherwise push a second,
  // parent-derived set on top of the real UTR subfeatures.
  const impliedUTRs = !hasUTRs && config.impliedUTRs

  if (impliedUTRs) {
    c = makeUTRs(f, c)
  }

  const allowedTypes = new Set(
    config.subParts.split(',').map(t => t.trim().toLowerCase()),
  )
  return c.filter(child => allowedTypes.has(featureType(child).toLowerCase()))
}
