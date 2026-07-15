#!/usr/bin/env node
// Injects simulated SnpEff `ANN` consequence annotations into a multi-sample
// VCF so the "Color cells by consequence" mode of the multi-sample variant
// display has data to render. Each record gets one ANN entry per ALT allele
// with a deterministic impact tier (HIGH/MODERATE/LOW/MODIFIER) cycled by
// position, giving a visible spread of impact colors across the track.
//
// Usage:
//   node annotate_variants.mjs [input.vcf.gz] [output.vcf.gz]
// Defaults to rewriting volvox.test.vcf.gz in place. Requires bgzip + tabix on
// PATH. Re-run to regenerate.

import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { gunzipSync } from 'zlib'

const input = process.argv[2] ?? 'volvox.test.vcf.gz'
const output = process.argv[3] ?? input

// SnpEff ANN field order: Allele | Annotation | Annotation_Impact | Gene_Name |
// ... — variantConsequence.ts reads the SO term at field index 1 and finds the
// impact tier token anywhere in the entry.
const ANN_HEADER =
  '##INFO=<ID=ANN,Number=.,Type=String,Description="Functional annotations: ' +
  "'Allele | Annotation | Annotation_Impact | Gene_Name | Gene_ID | " +
  'Feature_Type | Feature_ID | Transcript_BioType | Rank | HGVS.c | HGVS.p | ' +
  'cDNA.pos / cDNA.length | CDS.pos / CDS.length | AA.pos / AA.length\'">'

// Consequence SO term paired with its impact tier; cycled so every tier shows
// up regularly across the track.
const CONSEQUENCES = [
  ['stop_gained', 'HIGH'],
  ['missense_variant', 'MODERATE'],
  ['synonymous_variant', 'LOW'],
  ['intron_variant', 'MODIFIER'],
  ['frameshift_variant', 'HIGH'],
  ['inframe_deletion', 'MODERATE'],
  ['splice_region_variant', 'LOW'],
  ['intergenic_region', 'MODIFIER'],
]
const GENES = ['GENEA', 'GENEB', 'GENEC', 'GENED']

function annForAllele(alt, seed) {
  const [cons, impact] = CONSEQUENCES[seed % CONSEQUENCES.length]
  const gene = GENES[seed % GENES.length]
  return `${alt}|${cons}|${impact}|${gene}|${gene}|transcript|${gene}.t1|protein_coding|1/1|c.1A>T|p.Xaa1Yaa`
}

const lines = gunzipSync(readFileSync(input)).toString('utf8').split('\n')
const out = []
let headerDone = false
let recordIdx = 0
for (const line of lines) {
  if (line.startsWith('##')) {
    out.push(line)
  } else if (line.startsWith('#CHROM')) {
    // emit the ANN header just before the column header if not already present
    if (!headerDone) {
      out.push(ANN_HEADER)
      headerDone = true
    }
    out.push(line)
  } else if (line.length === 0) {
    out.push(line)
  } else {
    const cols = line.split('\t')
    const alts = (cols[4] ?? '.').split(',')
    const ann = alts.map((alt, i) => annForAllele(alt, recordIdx + i)).join(',')
    const info = cols[7] ?? '.'
    cols[7] = info === '.' ? `ANN=${ann}` : `${info};ANN=${ann}`
    out.push(cols.join('\t'))
    recordIdx++
  }
}

const plain = `${output}.tmp.vcf`
writeFileSync(plain, out.join('\n'))
execFileSync('bash', [
  '-c',
  `bgzip -f -c ${JSON.stringify(plain)} > ${JSON.stringify(output)} && ` +
    `tabix -f -p vcf ${JSON.stringify(output)} && rm ${JSON.stringify(plain)}`,
])
console.log(`annotated ${recordIdx} records -> ${output} (+ .tbi)`)
