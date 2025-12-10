import { SimpleFeature } from '@jbrowse/core/util'

const svTypes = new Set(['DUP', 'TRA', 'INV', 'CNV', 'DEL'])

export function featureData(
  line: string,
  uniqueId: string,
  flip: boolean,
  names?: string[],
) {
  const l = line.split('\t')
  const ref1 = l[flip ? 3 : 0]!
  const start1 = +l[flip ? 4 : 1]!
  const end1 = +l[flip ? 5 : 2]!
  const ref2 = l[!flip ? 3 : 0]!
  const start2 = +l[!flip ? 4 : 1]!
  const end2 = +l[!flip ? 5 : 2]!
  const name = l[6]!
  const score = l[7] ? +l[7] : undefined
  const strand1 = parseStrand(l[8]!)
  const strand2 = parseStrand(l[9]!)
  const extra = l.slice(10)
  const rest = names
    ? Object.fromEntries(names.slice(10).map((n, idx) => [n, extra[idx]]))
    : {}
  const ALT = svTypes.has(extra[0]!) ? `<${extra[0]}>` : undefined

  return new SimpleFeature({
    ...rest,
    start: start1,
    end: end1,
    type: 'paired_feature',
    refName: ref1,
    strand: strand1,
    name,
    score,
    uniqueId,
    mate: {
      refName: ref2,
      start: start2,
      end: end2,
      strand: strand2,
    },
    ...(ALT ? { ALT: [ALT] } : {}), // ALT is an array in VCF
  })
}

function parseStrand(strand: string) {
  if (strand === '+') {
    return 1
  } else if (strand === '-') {
    return -1
  } else if (strand === '.') {
    return 0
  } else {
    return undefined
  }
}
