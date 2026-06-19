import { type Feature, SimpleFeature } from '@jbrowse/core/util'

import { isCDS, isExon, isUTR } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'

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

  let haveLeftUTR = false
  let haveRightUTR = false

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

  for (const sub of subparts) {
    if (isExon(sub)) {
      const exonStart = sub.get('start')
      const exonEnd = sub.get('end')
      if (exonStart < codeStart) {
        haveLeftUTR = true
        subparts.push(
          new SimpleFeature({
            uniqueId: `${sub.id()}-utr`,
            refName: parentRefName,
            start: exonStart,
            end: Math.min(exonEnd, codeStart),
            strand: parentStrand,
            type: utrType(parentStrand, true),
          }),
        )
      }
      if (exonEnd > codeEnd) {
        haveRightUTR = true
        subparts.push(
          new SimpleFeature({
            uniqueId: `${sub.id()}-utr2`,
            refName: parentRefName,
            start: Math.max(exonStart, codeEnd),
            end: exonEnd,
            strand: parentStrand,
            type: utrType(parentStrand, false),
          }),
        )
      }
    }
  }

  if (!haveLeftUTR && parentStart < codeStart) {
    subparts.push(
      new SimpleFeature({
        uniqueId: `${parent.id()}-utr-left`,
        refName: parentRefName,
        start: parentStart,
        end: codeStart,
        strand: parentStrand,
        type: utrType(parentStrand, true),
      }),
    )
  }

  if (!haveRightUTR && parentEnd > codeEnd) {
    subparts.push(
      new SimpleFeature({
        uniqueId: `${parent.id()}-utr-right`,
        refName: parentRefName,
        start: codeEnd,
        end: parentEnd,
        strand: parentStrand,
        type: utrType(parentStrand, false),
      }),
    )
  }

  return subparts
}

export function getSubparts(f: Feature, config: DisplayConfig) {
  let c = f.get('subfeatures')
  if (!c || c.length === 0) {
    return []
  }
  const hasUTRs = c.some(child => isUTR(child))
  // Use the configured transcriptTypes (which includes primary_transcript by
  // default) rather than a separate hardcoded list, so every type that routes
  // to this layout can also get implied UTRs.
  const isTranscript = config.transcriptTypes.includes(f.get('type') ?? '')
  const impliedUTRs = !hasUTRs && isTranscript

  if (impliedUTRs || config.impliedUTRs) {
    c = makeUTRs(f, c)
  }

  const allowedTypes = new Set(
    config.subParts.split(/\s*,\s*/).map(t => t.toLowerCase()),
  )
  return c.filter(child =>
    allowedTypes.has(child.get('type')?.toLowerCase() ?? ''),
  )
}
