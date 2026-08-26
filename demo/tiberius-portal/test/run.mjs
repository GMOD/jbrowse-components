// Regenerate the fixture and check the classifier still puts every model in the
// class the fixture was built to produce. Runs offline in about a second.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  absoluteLink,
  apolloLink,
  captureAll,
  relativeLink,
  sessionFor,
} from '../lib/capture.mjs'
import { classify } from '../lib/classify.mjs'
import { buildConfig } from '../lib/prepare.mjs'

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

// ---- the links a card carries -------------------------------------------

const candidate = { refName: 'chr22', start: 20000, end: 30000 }
const { loc, session } = sessionFor(candidate, ['prediction'], 'hg38')

// 15% of a 10 kb model is 1,500, under the 2 kb floor, so both ends move 2 kb
check('a small model gets the padding floor, not 15%', loc, 'chr22:18000-32000')
check(
  'a big model gets 15% of its span',
  sessionFor({ refName: 'chr22', start: 100000, end: 200000 }, [], 'hg38').loc,
  'chr22:85000-215000',
)
check(
  'padding cannot walk off the start of a contig',
  sessionFor({ refName: 'chr22', start: 10, end: 400 }, [], 'hg38').loc,
  'chr22:1-2400',
)
check('the session names the tracks it was given', session.views[0].tracks, [
  'prediction',
])

check(
  'a bundled portal links relatively, config included',
  relativeLink(session),
  `jbrowse/?config=../config.json&session=${encodeURIComponent(`spec-${JSON.stringify(session)}`)}`,
)
check(
  'a hosted portal links absolutely, config encoded',
  absoluteLink(
    session,
    'https://jbrowse.org/code/jb2/latest',
    'https://example.org/config.json',
  ),
  `https://jbrowse.org/code/jb2/latest/?config=${encodeURIComponent('https://example.org/config.json')}&session=${encodeURIComponent(`spec-${JSON.stringify(session)}`)}`,
)

// The Apollo link carries NO config — the Apollo server's own is the point —
// and by default no tracks, because Apollo adds apollo_track_<assembly> from a
// reaction that runs after the session parses. A link naming a track its config
// does not itself declare fails to open at all, which is worse than arriving
// with the layer switched off.
const apolloUrl = apolloLink(
  sessionFor(candidate, [], 'hg38').session,
  'https://apollo.example.org/',
)
check('an Apollo link carries no config', apolloUrl.includes('config='), false)
check(
  'an Apollo link opens no track by default',
  JSON.parse(decodeURIComponent(apolloUrl.split('session=spec-')[1])).views[0]
    .tracks,
  [],
)
check(
  'an Apollo link opens the track it is given',
  JSON.parse(
    decodeURIComponent(
      apolloLink(
        sessionFor(candidate, ['apollo_track_hg38'], 'hg38').session,
        'https://apollo.example.org/',
      ).split('session=spec-')[1],
    ),
  ).views[0].tracks,
  ['apollo_track_hg38'],
)

// ---- the config the pictures and the links share -------------------------

const withEvidence = buildConfig({
  assembly: 'hg38',
  fastaRef: 'hg38.fa.gz',
  predictionRef: 'prediction.gff.gz',
  referenceRef: 'reference.gff.gz',
  rnaRefs: ['brain.bam', 'uhr.bam'],
  rnaNames: ['brain'],
  rnaHeight: 110,
})
const evidence = withEvidence.tracks.filter(t => t.type === 'AlignmentsTrack')
check(
  'an unnamed second evidence track keeps its number',
  evidence.map(t => t.name),
  ['brain', 'RNA-seq 2'],
)
// The height rides in the track config because that is the only one of the
// three routes a released JBrowse honours — displayDefaults postdates it, and a
// session spec's tracks are ids rather than objects.
check(
  'each evidence lane carries its own display',
  evidence.map(t => t.displays[0].displayId),
  ['rnaseq_1-LinearAlignmentsDisplay', 'rnaseq_2-LinearAlignmentsDisplay'],
)
check(
  'the lane height is the one asked for',
  evidence[0].displays[0].height,
  110,
)
check(
  'and an unasked-for height leaves the display alone',
  buildConfig({
    assembly: 'hg38',
    fastaRef: 'hg38.fa.gz',
    predictionRef: 'prediction.gff.gz',
    referenceRef: null,
    rnaRefs: ['brain.bam'],
  }).tracks.find(t => t.type === 'AlignmentsTrack').displays,
  undefined,
)

// ---- a flaky capture gets a second go -----------------------------------

// A stub standing in for jb2capture: fails its first N runs, writes the PNG
// after that. Nothing here launches a browser.
function stubBin(failuresBeforeSuccess) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-capture-'))
  const counter = path.join(dir, 'runs')
  fs.writeFileSync(counter, '0')
  const bin = path.join(dir, 'stub.mjs')
  fs.writeFileSync(
    bin,
    `import fs from 'node:fs'
const runs = Number(fs.readFileSync(${JSON.stringify(counter)}, 'utf8')) + 1
fs.writeFileSync(${JSON.stringify(counter)}, String(runs))
if (runs <= ${failuresBeforeSuccess}) {
  process.stderr.write('jb2capture: Attempted to use detached Frame\\n')
  process.exit(1)
}
fs.writeFileSync(process.argv[process.argv.indexOf('-o') + 1], 'png')
`,
  )
  return { bin, dir, runs: () => Number(fs.readFileSync(counter, 'utf8')) }
}

const captureArgs = {
  candidates: [
    { id: 'g1.t1', refName: 'chr22', start: 20000, end: 30000, cls: 'merge' },
  ],
  trackIds: ['prediction'],
  assembly: 'hg38',
  instance: 'http://127.0.0.1:1/',
  configUrl: 'http://127.0.0.1:1/config.json',
  width: 800,
  height: 400,
  scale: 1,
  settle: 0,
  timeout: 5000,
}

const flaky = stubBin(1)
const retried = await captureAll({
  ...captureArgs,
  outDir: path.join(flaky.dir, 'img'),
  captureBin: flaky.bin,
})
check(
  'a flake costs a card nothing',
  [retried[0].ok, retried[0].tries],
  [true, 2],
)
check('and the second run is what wrote the picture', flaky.runs(), 2)

const dead = stubBin(99)
const gaveUp = await captureAll({
  ...captureArgs,
  outDir: path.join(dead.dir, 'img'),
  captureBin: dead.bin,
})
check(
  'a locus that will not draw is reported, not retried forever',
  [gaveUp[0].ok, gaveUp[0].tries, gaveUp[0].file],
  [false, 2, null],
)
check('the run gives up after the second try', dead.runs(), 2)
check(
  'and the card is told why',
  gaveUp[0].note.includes('detached Frame'),
  true,
)

fs.rmSync(flaky.dir, { recursive: true, force: true })
fs.rmSync(dead.dir, { recursive: true, force: true })

console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed')
process.exit(failures ? 1 : 0)
