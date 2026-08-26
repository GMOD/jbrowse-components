// Regenerate the fixture and check the classifier still puts every model in the
// class the fixture was built to produce. Runs offline in about a second.
import { execFileSync } from 'node:child_process'
import path from 'node:path'

import { classify } from '../lib/classify.mjs'

const HERE = import.meta.dirname
const FIXTURE = path.join(HERE, 'fixture')

execFileSync('node', [path.join(HERE, 'make-fixture.mjs'), FIXTURE], {
  stdio: 'pipe',
})

let failures = 0
function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`ok   ${name}`)
  } else {
    console.log(`FAIL ${name}\n       expected ${e}\n       actual   ${a}`)
    failures++
  }
}

const { rows, tally, total } = classify({
  predictionFile: path.join(FIXTURE, 'prediction.gff3'),
  referenceFile: path.join(FIXTURE, 'reference.gff3'),
})

check('every predicted transcript is classified', total, 12)
check('class tally', tally, {
  agrees: 7,
  merge: 1,
  'structure-conflict': 1,
  'novel-coding': 1,
  'novel-locus': 2,
})

// The one that fails if the comparison goes back to span overlap: INNER sits in
// OUTER's intron on the same strand, so both spans contain the prediction and
// only exon overlap tells them apart.
const nested = rows.find(r => r.id === 'g500.t1')
check('a gene nested in an intron is not a merge', nested?.cls, 'agrees')
check(
  'the nested case names only the gene it shares exons with',
  nested?.genes,
  ['OUTER'],
)

const merge = rows.find(r => r.cls === 'merge')
check('the merge names both fused genes', merge?.genes, ['FUSEA', 'FUSEB'])
check('the merge reports the gap between them', merge?.gapBp, 3999)

const conflict = rows.find(r => r.cls === 'structure-conflict')
check('the structure conflict names its gene', conflict?.genes, ['SHIFTY'])

const novel = rows.filter(r => r.cls === 'novel-locus').map(r => r.refName)
check('novel loci are the ones off the annotated contig', novel, [
  'ctgB',
  'ctgB',
])

// Restricting to a contig must not reclassify what stays in scope.
const scoped = classify({
  predictionFile: path.join(FIXTURE, 'prediction.gff3'),
  referenceFile: path.join(FIXTURE, 'reference.gff3'),
  refNames: new Set(['ctgA']),
})
check('--region drops the other contig only', scoped.tally, {
  agrees: 7,
  merge: 1,
  'structure-conflict': 1,
  'novel-coding': 1,
})

// A file compared against itself agrees with itself. This is what caught exons
// being keyed by a name attribute their own line does not carry — before that
// fix a self-comparison reported every model as a novel locus.
//
// LINCX is the exception and is not a bug: the classes are written for a
// coding-gene predictor, so a lncRNA model lands in novel-coding even when the
// reference is the same file.
const self = classify({
  predictionFile: path.join(FIXTURE, 'reference.gff3'),
  referenceFile: path.join(FIXTURE, 'reference.gff3'),
})
check('a self-comparison agrees with itself', self.tally, {
  agrees: 11,
  'novel-coding': 1,
})

console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed')
process.exit(failures ? 1 : 0)
