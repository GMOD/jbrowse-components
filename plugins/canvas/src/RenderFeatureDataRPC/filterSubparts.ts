import { type Feature, SimpleFeature } from '@jbrowse/core/util'

import { isUTR } from './util.ts'

function makeSubpartsFilter(confKey: string, config: Record<string, unknown>) {
  const filter = (config[confKey] ??
    'CDS,UTR,five_prime_UTR,three_prime_UTR') as string[] | string
  const ret = typeof filter === 'string' ? filter.split(/\s*,\s*/) : filter
  const lowerRet = new Set(ret.map(t => t.toLowerCase()))

  return (feature: Feature) => lowerRet.has(feature.get('type').toLowerCase())
}

export function makeUTRs(parent: Feature, subs: Feature[]) {
  const subparts = [...subs]

  let codeStart = Number.POSITIVE_INFINITY
  let codeEnd = Number.NEGATIVE_INFINITY

  let haveLeftUTR: boolean | undefined
  let haveRightUTR: boolean | undefined

  for (const sub of subparts) {
    if (sub.get('type') === 'CDS') {
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
  const parentStrand = parent.get('strand')
  const parentRefName = parent.get('refName')

  for (const sub of subparts) {
    const type = sub.get('type')
    if (type === 'exon') {
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
            type:
              parentStrand > 0
                ? 'five_prime_UTR'
                : parentStrand < 0
                  ? 'three_prime_UTR'
                  : 'UTR',
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
            type:
              parentStrand > 0
                ? 'three_prime_UTR'
                : parentStrand < 0
                  ? 'five_prime_UTR'
                  : 'UTR',
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
        type:
          parentStrand > 0
            ? 'five_prime_UTR'
            : parentStrand < 0
              ? 'three_prime_UTR'
              : 'UTR',
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
        type:
          parentStrand > 0
            ? 'three_prime_UTR'
            : parentStrand < 0
              ? 'five_prime_UTR'
              : 'UTR',
      }),
    )
  }

  return subparts
}

export function getSubparts(f: Feature, config: Record<string, unknown>) {
  let c = f.get('subfeatures')
  if (!c || c.length === 0) {
    return []
  }
  const hasUTRs = c.some(child => isUTR(child))
  const isTranscript = ['mRNA', 'transcript'].includes(f.get('type'))
  const impliedUTRs = !hasUTRs && isTranscript

  if (impliedUTRs || config.impliedUTRs) {
    c = makeUTRs(f, c)
  }

  const subpartFilter = makeSubpartsFilter('subParts', config)
  return c.filter(subpartFilter)
}
