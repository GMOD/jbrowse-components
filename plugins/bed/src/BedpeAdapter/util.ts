import { SimpleFeature } from '@jbrowse/core/util'

import { parseStrand } from '../util.ts'

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
  const ref2 = l[flip ? 0 : 3]!
  const start2 = +l[flip ? 1 : 4]!
  const end2 = +l[flip ? 2 : 5]!
  // '.' is BED's "missing" marker, so a file that leaves the standard name and
  // score columns unset must not produce the literal string '.' and a NaN
  // score. Same rule `defaultParser` applies on the plain-BED path.
  const name = l[6] === '.' ? undefined : l[6]
  const score = l[7] && l[7] !== '.' ? +l[7] : undefined
  // Columns 9 and 10 ride with the blocks they describe. Left behind on a
  // flipped row they anchored the feature at one end and gave it the other
  // end's orientation, which every consumer reading a junction edge off the
  // strand then got backwards for that half of the record.
  const strand1 = parseStrand(l[flip ? 9 : 8])
  const strand2 = parseStrand(l[flip ? 8 : 9])
  const extra = l.slice(10)
  const rest = names
    ? Object.fromEntries(names.slice(10).map((n, idx) => [n, extra[idx]]))
    : {}
  const ALT = svTypes.has(extra[0]!) ? `<${extra[0]}>` : undefined

  // `name` and `score` are spread only when the file actually sets them, which
  // is what lets a column past 10 of the same name through. juicer's bedpe is
  // the case that needs it: Arrowhead writes '.' in both standard columns and
  // its corner score in column 12, also called `score`, so an unconditional
  // positional key shadowed the only column the caller ranks domains by.
  return new SimpleFeature({
    ...rest,
    start: start1,
    end: end1,
    type: 'paired_feature',
    refName: ref1,
    strand: strand1,
    ...(name === undefined ? {} : { name }),
    ...(score === undefined ? {} : { score }),
    uniqueId,
    mate: {
      refName: ref2,
      start: start2,
      end: end2,
      strand: strand2,
    },
    ...(ALT ? { ALT: [ALT] } : {}),
  })
}
