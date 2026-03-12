import { readConfObject } from '@jbrowse/core/configuration'
import { type Feature, SimpleFeature } from '@jbrowse/core/util'

import { isUTR } from './util.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

function makeSubpartsFilter(
  confKey: string | string[],
  config: AnyConfigurationModel,
) {
  const filter = readConfObject(config, confKey) as string[] | string
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

  // gather exons, find coding start and end, and look for UTRs
  const exons = []
  for (const subpart of subparts) {
    const type = subpart.get('type')
    if (/^cds/i.test(type)) {
      if (codeStart > subpart.get('start')) {
        codeStart = subpart.get('start')
      }
      if (codeEnd < subpart.get('end')) {
        codeEnd = subpart.get('end')
      }
    } else if (/exon/i.test(type)) {
      exons.push(subpart)
    } else if (isUTR(subpart)) {
      haveLeftUTR = subpart.get('start') === parent.get('start')
      haveRightUTR = subpart.get('end') === parent.get('end')
    }
  }

  // bail if we don't have exons and CDS
  if (
    !(
      exons.length &&
      codeStart < Number.POSITIVE_INFINITY &&
      codeEnd > Number.NEGATIVE_INFINITY
    )
  ) {
    return subparts
  }

  // make sure the exons are sorted by coord
  exons.sort((a, b) => a.get('start') - b.get('start'))

  const strand = parent.get('strand')

  // make the left-hand UTRs
  let start: number | undefined
  let end: number | undefined
  if (!haveLeftUTR) {
    for (const [i, exon] of exons.entries()) {
      start = exon.get('start')
      if (start >= codeStart) {
        break
      }
      end = Math.min(codeStart, exon.get('end'))
      const type = strand >= 0 ? 'five_prime_UTR' : 'three_prime_UTR'
      subparts.unshift(
        new SimpleFeature({
          parent,
          id: `${parent.id()}_${type}_${i}`,
          data: { start, end, strand, type },
        }),
      )
    }
  }

  // make the right-hand UTRs
  if (!haveRightUTR) {
    for (let i = exons.length - 1; i >= 0; i--) {
      end = exons[i]!.get('end')
      if (end <= codeEnd) {
        break
      }

      start = Math.max(codeEnd, exons[i]!.get('start'))
      const type = strand >= 0 ? 'three_prime_UTR' : 'five_prime_UTR'
      subparts.push(
        new SimpleFeature({
          parent,
          id: `${parent.id()}_${type}_${i}`,
          data: { start, end, strand, type },
        }),
      )
    }
  }

  return subparts
}

export function getSubparts(f: Feature, config: AnyConfigurationModel) {
  let c = f.get('subfeatures')
  if (!c || c.length === 0) {
    return []
  }
  const hasUTRs = c.some(child => isUTR(child))
  const isTranscript = ['mRNA', 'transcript'].includes(f.get('type'))
  const impliedUTRs = !hasUTRs && isTranscript

  if (impliedUTRs || readConfObject(config, 'impliedUTRs')) {
    c = makeUTRs(f, c)
  }

  const subpartFilter = makeSubpartsFilter('subParts', config)
  return c.filter(subpartFilter)
}
