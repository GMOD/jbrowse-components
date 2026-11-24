// Writes qm2_hprc_haplotypes_chr3_cnv.tsv: for each of the 2,504 QuicK-mer2
// individuals in qm2_cn_1kb.bedgraph.gz, the structural form each of its HPRC
// release 2.1 haplotypes takes at the two deletion alleles on chr3, blank where
// HPRC has no assembly of it. Prints, for the paper's Figure 2 text, how many
// haplotypes take each form, how many of the individuals the copy number
// agrees with, and the 1000 Genomes callset's genotype for the 114 kb allele
// by each individual's pair of HPRC haplotypes.
//
//   npm install @jbrowse/graph-walks@9.1.0
//   node build_hprc_haplotypes_chr3_cnv.mjs > qm2_hprc_haplotypes_chr3_cnv.tsv \
//     2> build_hprc_haplotypes_chr3_cnv.report.txt
//
// Needs tabix on the PATH.
import { execFileSync } from 'node:child_process'

import {
  WalkReader,
  formTag,
  formsCut,
  structuralForms,
} from '@jbrowse/graph-walks'

const WALKS =
  'https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38-f8.GRCh38.walks.gz'
const BEDGRAPH = 'https://jbrowse.org/demos/1000g/qm2_cn_1kb.bedgraph.gz'
const CALLSET =
  'https://jbrowse.org/demos/1000g/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz'
const CALLSET_114KB = { id: 'HGSV_105993', region: 'chr3:162794000-162795500' }
const WINDOW = { refName: 'chr3', start: 162_650_000, end: 163_050_000 }
const INNER = { start: 162_810_000, end: 162_828_000 }
const OUTER_ONLY = { start: 162_840_000, end: 162_900_000 }

// graph-walks' token for a form, `del 114kb` or `repl 114kb->8bp` by version
const FORM_LABELS = [
  [/^(del|repl) 114kb/, '114 kb deletion'],
  [/^(del|repl) 21.9kb/, '22 kb deletion'],
  [/^ref$/, 'neither'],
]

const reader = WalkReader.open(WALKS)
const result = structuralForms(await formsCut(reader, WINDOW), {
  window: WINDOW,
  exclude: ['CHM13'],
  floorBp: 10_000,
})
console.error(
  `forms of ${result.placed} placed haplotypes: ${result.forms.map(f => `${f.members.length} ${formTag(f, result)}`).join(', ')}`,
)
const formOf = new Map(
  result.forms.flatMap(form => {
    const tag = formTag(form, result)
    const label = FORM_LABELS.find(([pattern]) => pattern.test(tag))?.[1]
    if (!label) {
      throw new Error(`unexpected form ${tag}`)
    }
    return form.members.map(member => [member, label])
  }),
)

const tabix = args =>
  execFileSync('tabix', args, { encoding: 'utf8', maxBuffer: 2 ** 28 })
const header = tabix(['-H', BEDGRAPH]).trim().split('\n').at(-1).split('\t')
const samples = header.slice(3)
const lines = tabix([
  BEDGRAPH,
  `${WINDOW.refName}:${WINDOW.start}-${WINDOW.end}`,
])
  .trim()
  .split('\n')
  .map(line => line.split('\t'))

function meanCopyNumber(column, { start, end }) {
  const values = lines
    .filter(cols => +cols[1] >= start && +cols[2] <= end)
    .map(cols => +cols[column + 3])
    .filter(value => !Number.isNaN(value))
  return values.reduce((a, b) => a + b, 0) / values.length
}

const rows = samples.map(sample => [
  sample,
  formOf.get(`${sample}#1`) ?? '',
  formOf.get(`${sample}#2`) ?? '',
])
const assembled = rows.flatMap(([sample, hap1, hap2], column) =>
  hap1 && hap2 ? [{ sample, haps: [hap1, hap2], column }] : [],
)
const agreeing = assembled.filter(({ haps, column }) => {
  const lost = label => haps.filter(hap => hap === label).length
  const outer = lost('114 kb deletion')
  return (
    Math.round(meanCopyNumber(column, INNER)) ===
      2 - outer - lost('22 kb deletion') &&
    Math.round(meanCopyNumber(column, OUTER_ONLY)) === 2 - outer
  )
})
console.error(
  `${agreeing.length} of ${assembled.length} individuals with both HPRC haplotypes have the copy number their haplotypes predict`,
)
const vcfSamples = tabix(['-H', CALLSET]).trim().split('\n').at(-1).split('\t')
const record = tabix([CALLSET, CALLSET_114KB.region])
  .split('\n')
  .map(line => line.split('\t'))
  .find(cols => cols[2] === CALLSET_114KB.id)
const genotypeOf = new Map(
  vcfSamples
    .slice(9)
    .map((sample, i) => [
      sample,
      record[i + 9].split(':')[0].replace('|', '/'),
    ]),
)
const byPair = new Map()
for (const { sample, haps } of assembled) {
  const pair = haps.toSorted((a, b) => a.localeCompare(b)).join(' + ')
  const counts = byPair.get(pair) ?? new Map()
  const genotype = genotypeOf.get(sample) ?? 'absent'
  counts.set(genotype, (counts.get(genotype) ?? 0) + 1)
  byPair.set(pair, counts)
}
for (const [pair, counts] of [...byPair].toSorted(([a], [b]) =>
  a.localeCompare(b),
)) {
  console.error(
    `${pair}: ${CALLSET_114KB.id} ${[...counts].map(([g, n]) => `${g} x${n}`).join(', ')}`,
  )
}
process.stdout.write(
  [['name', 'hap1', 'hap2'], ...rows]
    .map(row => `${row.join('\t')}\n`)
    .join(''),
)
