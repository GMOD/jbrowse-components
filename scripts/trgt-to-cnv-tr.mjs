#!/usr/bin/env node
//
// Rewrites a TRGT VCF as VCF 4.5 <CNV:TR> records, the fields the tandem repeat
// card in JBrowse's variant feature widget reads.
//
//   node scripts/trgt-to-cnv-tr.mjs trgt.vcf[.gz] > cnv-tr.vcf
//   trgt merge ... | node scripts/trgt-to-cnv-tr.mjs - > cnv-tr.vcf
//
// TRGT writes each ALT allele as a full sequence. Here each becomes <CNV:TR>
// with the runs the record's samples state for it: FORMAT MS (one
// motif(start-end) span per run) where TRGT wrote it, else one run of the
// locus's single motif, its copies the allele's length over the motif's. A
// locus of several motifs with no MS states no runs, so the script skips it and
// says so on stderr. TRGT's own FORMAT fields, GT, AL, SD, MC and the rest, pass
// through, and GT indexes the same alleles.
//
// The runs are the spans TRGT called. Bases between two spans, an interruption
// like the CAA of (CAG)nCAACAG(CCG)n, and any before the first or after the
// last, count in the preceding run's RB, so an allele's RBs sum to its length
// (TRGT's AL) while RUC states only the copies TRGT found. TRGT also spans the
// CAG after that interruption as a run of its own, so an allele can carry two
// consecutive runs of one unit. Sort and bgzip the output before loading it in
// a tabix-indexed track.
import fs from 'node:fs'
import readline from 'node:readline'
import { pathToFileURL } from 'node:url'
import zlib from 'node:zlib'

const CNV_TR = '<CNV:TR>'
const MAX_NAME = 40

const HEADER = [
  '##ALT=<ID=CNV:TR,Description="Tandem repeat">',
  '##INFO=<ID=SVLEN,Number=A,Type=Integer,Description="Length of the reference allele">',
  '##INFO=<ID=RN,Number=A,Type=Integer,Description="Total number of repeat sequences in this allele">',
  '##INFO=<ID=RUS,Number=.,Type=String,Description="Repeat unit sequence of the corresponding repeat sequence">',
  '##INFO=<ID=RUL,Number=.,Type=Integer,Description="Repeat unit length of the corresponding repeat sequence">',
  '##INFO=<ID=RUC,Number=.,Type=Float,Description="Repeat unit count of corresponding repeat sequence">',
  '##INFO=<ID=RB,Number=.,Type=Integer,Description="Total number of bases in the corresponding repeat sequence">',
]

function parseInfo(text) {
  const info = new Map()
  for (const field of text.split(';')) {
    const at = field.indexOf('=')
    info.set(
      at < 0 ? field : field.slice(0, at),
      at < 0 ? '' : field.slice(at + 1),
    )
  }
  return info
}

// "0(0-51)_1(57-84)" is motif 0 over bases 0-51, motif 1 over 57-84
function parseSpans(ms) {
  return ms.split('_').flatMap(span => {
    const m = /^(\d+)\((\d+)-(\d+)\)$/.exec(span)
    return m
      ? [{ motif: Number(m[1]), start: Number(m[2]), end: Number(m[3]) }]
      : []
  })
}

const round = n => Number(n.toFixed(2))

// Each ALT allele's runs: from the first sample carrying it that states MS,
// else one run of the locus's only motif. undefined for an allele that has none.
export function allelesRuns({ alts, motifs, formatKeys, samples }) {
  const ms = formatKeys.indexOf('MS')
  const gt = formatKeys.indexOf('GT')
  const spans = new Map()
  if (ms >= 0) {
    for (const sample of samples) {
      const fields = sample.split(':')
      const indices = (fields[gt] ?? '').split(/[/|]/)
      const stated = (fields[ms] ?? '').split(',')
      indices.forEach((index, k) => {
        const i = Number(index)
        if (i > 0 && !spans.has(i) && stated[k] && stated[k] !== '.') {
          spans.set(i, parseSpans(stated[k]))
        }
      })
    }
  }
  return alts.map((alt, i) => {
    const bp = alt.length - 1
    const stated = spans.get(i + 1)
    const usable = (stated ?? [])
      .filter(s => motifs[s.motif] !== undefined && s.end > s.start)
      .sort((a, b) => a.start - b.start)
    if (usable.length) {
      return usable.map((s, k) => {
        const motif = motifs[s.motif]
        const next = usable[k + 1]?.start ?? bp
        return {
          motif,
          count: round((s.end - s.start) / motif.length),
          bp: Math.max(s.end - s.start, next - (k === 0 ? 0 : s.start)),
        }
      })
    }
    return motifs.length === 1 && bp > 0
      ? [{ motif: motifs[0], count: round(bp / motifs[0].length), bp }]
      : undefined
  })
}

// One TRGT record line as a <CNV:TR> record line, or undefined with the reason
export function convertRecord(line) {
  const f = line.split('\t')
  const [chrom, pos, id, ref, altField, qual, filter, infoField, format] = f
  const samples = f.slice(9)
  const info = parseInfo(infoField)
  const motifs = (info.get('MOTIFS') ?? '').split(',').filter(Boolean)
  const alts = altField === '.' ? [] : altField.split(',')
  if (alts.length === 0) {
    return { skipped: 'no ALT allele' }
  }
  if (motifs.length === 0) {
    return { skipped: 'no MOTIFS' }
  }
  const runs = allelesRuns({
    alts,
    motifs,
    formatKeys: (format ?? '').split(':'),
    samples,
  })
  if (runs.some(r => !r?.length)) {
    return { skipped: `alleles state no runs (${motifs.length} motifs, no MS)` }
  }
  const refBp = ref.length - 1
  const trid = info.get('TRID')
  const out = [
    ...[...info]
      .filter(
        ([key]) => !['SVLEN', 'RN', 'RUS', 'RUL', 'RUC', 'RB'].includes(key),
      )
      .map(([key, value]) => (value === '' ? key : `${key}=${value}`)),
    `SVLEN=${alts.map(() => refBp).join(',')}`,
    `RN=${runs.map(r => r.length).join(',')}`,
    `RUS=${runs.flatMap(r => r.map(x => x.motif)).join(',')}`,
    `RUL=${runs.flatMap(r => r.map(x => x.motif.length)).join(',')}`,
    `RUC=${runs.flatMap(r => r.map(x => x.count)).join(',')}`,
    `RB=${runs.flatMap(r => r.map(x => x.bp)).join(',')}`,
  ].join(';')
  const name = id !== '.' ? id : trid && trid.length <= MAX_NAME ? trid : '.'
  return {
    line: [
      chrom,
      pos,
      name,
      ref.slice(0, 1),
      alts.map(() => CNV_TR).join(','),
      qual,
      filter,
      out,
      format,
      ...samples,
    ].join('\t'),
  }
}

async function main(path) {
  if (!path) {
    console.error('usage: trgt-to-cnv-tr.mjs trgt.vcf[.gz] | -')
    process.exit(1)
  }
  const raw = path === '-' ? process.stdin : fs.createReadStream(path)
  const input = path.endsWith('.gz') ? raw.pipe(zlib.createGunzip()) : raw
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  const skipped = new Map()
  let written = 0
  let wroteHeader = false
  for await (const line of lines) {
    if (line.startsWith('##')) {
      if (
        !line.startsWith('##fileformat') &&
        !/^##INFO=<ID=(SVLEN|RN|RUS|RUL|RUC|RB),/.test(line)
      ) {
        process.stdout.write(`${line}\n`)
      } else if (line.startsWith('##fileformat')) {
        process.stdout.write('##fileformat=VCFv4.5\n')
      }
    } else if (line.startsWith('#')) {
      process.stdout.write(`${HEADER.join('\n')}\n${line}\n`)
      wroteHeader = true
    } else if (line) {
      const result = convertRecord(line)
      if (result.line) {
        process.stdout.write(`${result.line}\n`)
        written++
      } else {
        skipped.set(result.skipped, (skipped.get(result.skipped) ?? 0) + 1)
      }
    }
  }
  if (!wroteHeader) {
    throw new Error('no #CHROM line: not a VCF')
  }
  console.error(`${written} records written`)
  for (const [reason, n] of skipped) {
    console.error(`${n} records skipped: ${reason}`)
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main(process.argv[2])
}
