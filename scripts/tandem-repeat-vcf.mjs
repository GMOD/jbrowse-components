#!/usr/bin/env node
//
// States each haplotype's copies of a tandem repeat array as a VCF 4.5
// <CNV:TR> record, from a graph cut that holds the array and its flanks.
//
//   node scripts/tandem-repeat-vcf.mjs cut.gfa --bed arrays.bed [--name KIV-2]
//     [--divergence 0.01] > array.vcf
//
// The BED row (chrom, start, end, name, unit) names the array on the
// reference walk. Each W walk is cut between the reference nodes flanking the
// array and split into copies wherever the reference array's first 24 bases
// recur, and where those bases mutated, wherever 24-mers from further into the
// unit agree on a start. Copies whose k-mer containment puts them within
// --divergence of each other, average linkage, share a unit, and a unit's
// RUS is its medoid copy. Consecutive copies of one unit are one repeat
// sequence (RN), with RUC copies, RB bases and each copy's bases in RUB. A
// phased GT's k-th allele is PanSN haplotype k; the reference walk is a sample
// of its own, so its copies are stated too.
//
// It stands in for a repeat finder only where none reaches: TRGT needs reads
// spanning the array, and vamos 3.1.1, the assembly-mode finder, skips any
// allele over 30,000 bp (src/vntr.cpp) whatever -L says. Patched so that cap
// follows -L, and given each contig as one alignment record, vamos with this
// script's two units as motifs splits all nine KIV-2 haplotypes identically.
// It then needs 5-26 GB per allele for its DP tables, and on minimap2's own
// alignments, which cut these contigs into copy-sized pieces, it reports the
// last piece without warning: 6 copies for HG00128's 23.
import fs from 'node:fs'
import { parseArgs } from 'node:util'

const K = 15
const PROBE = 24

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    bed: { type: 'string' },
    name: { type: 'string' },
    divergence: { type: 'string', default: '0.01' },
    sites: { type: 'string' },
    'unit-names': { type: 'string' },
  },
})
const [gfaPath] = positionals
if (!gfaPath || !opts.bed) {
  console.error(
    'usage: tandem-repeat-vcf.mjs cut.gfa --bed arrays.bed [--name NAME] [--divergence 0.01] [--sites intervals.bed] [--unit-names A,B]',
  )
  process.exit(1)
}
const divergence = Number(opts.divergence)

const bedRow = fs
  .readFileSync(opts.bed, 'utf8')
  .split('\n')
  .map(line => line.split('\t'))
  .find(f => f.length >= 3 && (!opts.name || f[3] === opts.name))
if (!bedRow) {
  throw new Error(`no array ${opts.name ?? ''} in ${opts.bed}`)
}
const [chrom, bedStart, bedEnd, arrayName = '.'] = bedRow
const array = { start: Number(bedStart), end: Number(bedEnd) }

const segments = new Map()
const walks = []
let referenceSample
for (const line of fs.readFileSync(gfaPath, 'utf8').split('\n')) {
  const f = line.split('\t')
  if (f[0] === 'S') {
    segments.set(f[1], f[2])
  } else if (f[0] === 'H') {
    referenceSample ??= f.find(t => t.startsWith('RS:Z:'))?.slice(5)
  } else if (f[0] === 'W') {
    walks.push({
      sample: f[1],
      haplotype: Number(f[2]),
      start: Number(f[4]),
      steps: [...f[6].matchAll(/([<>])([^<>]+)/g)].map(m => ({
        id: m[2],
        reverse: m[1] === '<',
      })),
    })
  }
}
const reference =
  walks.find(w => w.sample === referenceSample && w.haplotype === 0) ?? walks[0]

const COMPLEMENT = { A: 'T', C: 'G', G: 'C', T: 'A' }
const revcomp = s =>
  [...s]
    .reverse()
    .map(b => COMPLEMENT[b] ?? 'N')
    .join('')
const stepSequence = ({ id, reverse }) => {
  const s = segments.get(id)
  return reverse ? revcomp(s) : s
}

const span = new Map()
let pos = reference.start
for (const step of reference.steps) {
  const len = segments.get(step.id).length
  if (!span.has(step.id)) {
    span.set(step.id, { start: pos, end: pos + len })
  }
  pos += len
}
const referenceSequence = reference.steps.map(stepSequence).join('')
const referenceBase = bp => referenceSequence[bp - reference.start]
const probe = referenceSequence.slice(
  array.start - reference.start,
  array.start - reference.start + PROBE,
)

// The walk's sequence between the nearest reference nodes it visits on either
// side of the array, read along the reference.
function sliceOf(walk) {
  let i0 = -1
  let i1 = -1
  walk.steps.forEach(({ id }, i) => {
    const s = span.get(id)
    if (
      s?.end <= array.start &&
      (i0 < 0 || s.end > span.get(walk.steps[i0].id).end)
    ) {
      i0 = i
    }
    if (
      s?.start >= array.end &&
      (i1 < 0 || s.start < span.get(walk.steps[i1].id).start)
    ) {
      i1 = i
    }
  })
  if (i0 < 0 || i1 < 0) {
    return undefined
  }
  const inner = walk.steps.slice(Math.min(i0, i1) + 1, Math.max(i0, i1))
  const text = inner.map(stepSequence).join('')
  return i0 < i1 ? text : revcomp(text)
}

function copiesOf(sequence) {
  const starts = []
  for (
    let i = sequence.indexOf(probe);
    i >= 0;
    i = sequence.indexOf(probe, i + 1)
  ) {
    starts.push(i)
  }
  return starts.map((start, i) =>
    sequence.slice(start, starts[i + 1] ?? sequence.length),
  )
}

const haplotypes = []
for (const walk of walks) {
  const sequence = sliceOf(walk)
  const copies = sequence === undefined ? [] : copiesOf(sequence)
  if (copies.length === 0) {
    console.error(
      `${walk.sample}#${walk.haplotype}: ${sequence === undefined ? 'does not reach both flanks' : 'no copy of the array start'}; left out`,
    )
    continue
  }
  haplotypes.push({ ...walk, copies })
}

const medianLength = copies => {
  const lengths = [...new Set(copies)].map(c => c.length).sort((a, b) => a - b)
  return lengths[lengths.length >> 1]
}
const typical = medianLength(haplotypes.flatMap(h => h.copies))

// Where a copy's first bases mutated, the probe misses that copy's start and
// two or three units read as one. Probes taken every BACKUP_STEP bases into
// the reference's first copy each imply a unit start at their hit less their
// offset, and the copy splits where BACKUP_SUPPORT of them agree to within
// BACKUP_SLOP bases, at least half a typical copy from any other split.
const BACKUP_STEP = 250
const BACKUP_SUPPORT = 3
const BACKUP_SLOP = 50
const firstCopy = copiesOf(
  referenceSequence.slice(
    array.start - reference.start,
    array.end - reference.start,
  ),
)[0]
const backups = []
for (let at = BACKUP_STEP; at + PROBE <= firstCopy.length; at += BACKUP_STEP) {
  backups.push({ at, kmer: firstCopy.slice(at, at + PROBE) })
}

function splitMerged(copy) {
  if (copy.length <= 1.5 * typical) {
    return [copy]
  }
  const implied = []
  for (const { at, kmer } of backups) {
    for (let i = copy.indexOf(kmer); i >= 0; i = copy.indexOf(kmer, i + 1)) {
      implied.push(i - at)
    }
  }
  implied.sort((a, b) => a - b)
  const cuts = [0]
  let group = []
  const settle = () => {
    const start = group[group.length >> 1]
    if (
      group.length >= BACKUP_SUPPORT &&
      start - cuts.at(-1) >= typical / 2 &&
      copy.length - start >= typical / 2
    ) {
      cuts.push(start)
    }
    group = []
  }
  for (const start of implied) {
    if (group.length > 0 && start - group[0] > BACKUP_SLOP) {
      settle()
    }
    group.push(start)
  }
  settle()
  return cuts.map((start, i) => copy.slice(start, cuts[i + 1] ?? copy.length))
}

for (const h of haplotypes) {
  h.copies = h.copies.flatMap(copy => {
    const pieces = splitMerged(copy)
    if (pieces.length > 1) {
      console.error(
        `${h.sample}#${h.haplotype}: a ${copy.length} bp copy splits into ${pieces.map(p => p.length).join(' + ')}`,
      )
    }
    return pieces
  })
}

const distinct = [...new Set(haplotypes.flatMap(h => h.copies))]
const referenceBp = array.end - array.start
const longest = Math.max(...distinct.map(c => c.length))
if (longest > 1.5 * typical) {
  console.error(
    `a ${longest} bp copy against a typical ${typical} stays whole: no backup probes agree on a start inside it`,
  )
}

const CODE = { A: 0, C: 1, G: 2, T: 3 }
const KMER_MASK = 4 ** K - 1
const unusualKmers = new Map()
function unusualKmerCode(k) {
  const r = revcomp(k)
  const key = k < r ? k : r
  if (!unusualKmers.has(key)) {
    unusualKmers.set(key, KMER_MASK + 1 + unusualKmers.size)
  }
  return unusualKmers.get(key)
}
// Canonical k-mers as sorted distinct integers; one holding a base other than
// ACGT keeps its own code past the 2-bit range.
function kmers(s) {
  const out = []
  let forward = 0
  let reverse = 0
  let run = 0
  for (let i = 0; i < s.length; i++) {
    const c = CODE[s[i]]
    if (c === undefined) {
      run = 0
    } else {
      forward = ((forward << 2) | c) & KMER_MASK
      reverse = (reverse >>> 2) | ((3 - c) << (2 * K - 2))
      run++
    }
    if (run >= K) {
      out.push(Math.min(forward, reverse))
    } else if (i + 1 >= K) {
      out.push(unusualKmerCode(s.slice(i + 1 - K, i + 1)))
    }
  }
  const sorted = Uint32Array.from(out).sort()
  return sorted.filter((k, i) => i === 0 || k !== sorted[i - 1])
}
function overlap(x, y) {
  let shared = 0
  for (let i = 0, j = 0; i < x.length && j < y.length;) {
    if (x[i] < y[j]) {
      i++
    } else if (x[i] > y[j]) {
      j++
    } else {
      shared++
      i++
      j++
    }
  }
  return shared
}
const n = distinct.length
const sets = distinct.map(kmers)
// Copies of one array share most k-mers, so each set is held as its symmetric
// difference with the k-mers most copies carry, and |A∩B| =
// |M| - |M\A| - |M\B| + |(AΔM)∩(BΔM)|.
const carriers = new Map()
for (const set of sets) {
  for (const k of set) {
    carriers.set(k, (carriers.get(k) ?? 0) + 1)
  }
}
const majority = Uint32Array.from(
  [...carriers].filter(([, c]) => 2 * c > n).map(([k]) => k),
).sort()
const isMajority = new Set(majority)
const lacks = sets.map(set => majority.length - overlap(set, majority))
const differs = sets.map(set => {
  const has = new Set(set)
  return Uint32Array.from([
    ...set.filter(k => !isMajority.has(k)),
    ...majority.filter(k => !has.has(k)),
  ]).sort()
})
// Containment rather than Jaccard, so the array's last, partial copy measures
// against the part of a full copy it covers.
function distance(a, b) {
  const shared =
    majority.length - lacks[a] - lacks[b] + overlap(differs[a], differs[b])
  const small = Math.min(sets[a].length, sets[b].length)
  return shared === 0 ? 1 : -Math.log(shared / small) / K
}
const D = Array.from({ length: n }, () => new Float64Array(n))
for (let a = 0; a < n; a++) {
  for (let b = a + 1; b < n; b++) {
    D[a][b] = D[b][a] = distance(a, b)
  }
}

const linkage = (x, y) => {
  let sum = 0
  for (const a of x) {
    for (const b of y) {
      sum += D[a][b]
    }
  }
  return sum / (x.length * y.length)
}
// Average linkage by the nearest-neighbour chain: merging reciprocal nearest
// neighbours with the Lance-Williams update builds the same tree as merging
// the closest pair each time, and the units are its merges within divergence.
const L = D.map(row => row.slice())
const size = new Array(n).fill(1)
const alive = new Array(n).fill(true)
const parent = Array.from({ length: n }, (_, i) => i)
const root = i => (parent[i] === i ? i : (parent[i] = root(parent[i])))
const chain = []
for (let remaining = n; remaining > 1;) {
  if (chain.length === 0) {
    chain.push(alive.indexOf(true))
  }
  const a = chain.at(-1)
  const previous = chain.at(-2)
  let b = previous
  let d = previous === undefined ? Infinity : L[a][previous]
  for (let k = 0; k < n; k++) {
    if (alive[k] && k !== a && L[a][k] < d) {
      b = k
      d = L[a][k]
    }
  }
  if (b !== previous) {
    chain.push(b)
    continue
  }
  chain.length -= 2
  if (d <= divergence) {
    parent[root(b)] = root(a)
  }
  for (let k = 0; k < n; k++) {
    if (alive[k] && k !== a && k !== b) {
      L[a][k] = L[k][a] =
        (size[a] * L[a][k] + size[b] * L[b][k]) / (size[a] + size[b])
    }
  }
  size[a] += size[b]
  alive[b] = false
  remaining--
}
const clusters = [...Map.groupBy(distinct.keys(), root).values()]

// A unit's sequence is its medoid among the copies of typical length, so RUS
// is a copy some haplotype carries rather than a consensus none does. A copy
// spanning two, where the array start mutated, contains every other and would
// otherwise win.
const unitOf = new Map()
for (const members of clusters) {
  const typicalLength = members.filter(
    i => Math.abs(distinct[i].length - typical) <= 0.1 * typical,
  )
  const pool = typicalLength.length > 0 ? typicalLength : members
  const medoid = pool.reduce((best, i) =>
    linkage([i], members) < linkage([best], members) ? i : best,
  )
  for (const i of members) {
    unitOf.set(distinct[i], distinct[medoid])
  }
}
console.error(
  `${haplotypes.length} walks, ${haplotypes.reduce((s, h) => s + h.copies.length, 0)} copies (${n} distinct), ${clusters.length} units at ${divergence * 100}% divergence`,
)

// --sites takes BED rows on the reference inside the array (chrom, start,
// end, name, score, strand), e.g. one copy's exons. Each distinct copy's
// stretch at the same place in its unit is read on the row's strand, and the
// positions where the units' commonest bases differ go to stderr, numbered
// from 1 along that strand.
if (opts.sites) {
  const arraySequence = referenceSequence.slice(
    array.start - reference.start,
    array.end - reference.start,
  )
  const copyStarts = []
  for (
    let i = arraySequence.indexOf(probe);
    i >= 0;
    i = arraySequence.indexOf(probe, i + 1)
  ) {
    copyStarts.push(i)
  }
  const copiesPerUnit = new Map()
  for (const h of haplotypes) {
    for (const copy of h.copies) {
      const unit = unitOf.get(copy)
      copiesPerUnit.set(unit, (copiesPerUnit.get(unit) ?? 0) + 1)
    }
  }
  const units = [...copiesPerUnit.keys()].sort(
    (a, b) => copiesPerUnit.get(b) - copiesPerUnit.get(a),
  )
  const label = unit =>
    `unit ${units.indexOf(unit) + 1} (${unit.length} bp, ${copiesPerUnit.get(unit)} copies)`
  const rows = fs
    .readFileSync(opts.sites, 'utf8')
    .split('\n')
    .map(line => line.split('\t'))
    .filter(f => f.length >= 3 && f[0] === chrom)
  for (const [, startText, endText, name = '.', , strand = '+'] of rows) {
    const start = Number(startText) - array.start
    const length = Number(endText) - Number(startText)
    const copyStart = copyStarts.findLast(c => c <= start)
    if (start < 0 || copyStart === undefined) {
      console.error(`${name}: not inside the array; skipped`)
      continue
    }
    const at = start - copyStart
    const template = arraySequence.slice(start, start + length)
    const tally = new Map(
      units.map(u => [u, Array.from({ length }, () => new Map())]),
    )
    let missed = 0
    for (const copy of distinct) {
      let best = { from: -1, mismatches: Infinity }
      const last = Math.min(copy.length - length, at + 300)
      for (let from = Math.max(0, at - 300); from <= last; from++) {
        let mismatches = 0
        for (let i = 0; i < length && mismatches < best.mismatches; i++) {
          if (copy[from + i] !== template[i]) {
            mismatches++
          }
        }
        if (mismatches < best.mismatches) {
          best = { from, mismatches }
        }
      }
      if (best.mismatches > 0.05 * length) {
        missed++
        continue
      }
      const stretch = copy.slice(best.from, best.from + length)
      const read = strand === '-' ? revcomp(stretch) : stretch
      const columns = tally.get(unitOf.get(copy))
      ;[...read].forEach((base, i) => {
        columns[i].set(base, (columns[i].get(base) ?? 0) + 1)
      })
    }
    console.error(
      `${name} (${length} bp, ${strand} strand): ${distinct.length - missed} of ${distinct.length} distinct copies read`,
    )
    const commonest = column => {
      const total = [...column.values()].reduce((a, b) => a + b, 0)
      const [base, count] = [...column].sort((a, b) => b[1] - a[1])[0]
      return { base, share: count / total }
    }
    for (let i = 0; i < length; i++) {
      const tops = units
        .filter(u => tally.get(u)[i].size > 0)
        .map(u => ({ unit: u, ...commonest(tally.get(u)[i]) }))
      if (new Set(tops.map(t => t.base)).size > 1) {
        console.error(
          `  position ${i + 1}: ${tops.map(t => `${label(t.unit)} ${t.base} ${(100 * t.share).toFixed(1)}%`).join(', ')}`,
        )
      }
    }
  }
}

function runsOf(copies) {
  const runs = []
  for (const copy of copies) {
    const unit = unitOf.get(copy)
    const last = runs.at(-1)
    if (last?.unit === unit) {
      last.copyBp.push(copy.length)
    } else {
      runs.push({ unit, copyBp: [copy.length] })
    }
  }
  return runs
}

const alleles = []
const alleleIndex = new Map()
const samples = new Map()
for (const h of haplotypes) {
  const runs = runsOf(h.copies)
  const key = JSON.stringify(runs)
  if (!alleleIndex.has(key)) {
    alleles.push(runs)
    alleleIndex.set(key, alleles.length)
  }
  const calls = samples.get(h.sample) ?? new Map()
  calls.set(h.haplotype, alleleIndex.get(key))
  samples.set(h.sample, calls)
}

// --unit-names names the units in the order the repeat card numbers them, most
// copies across the record's alleles first, into RUNAME beside RUS
const unitNames = new Map()
if (opts['unit-names']) {
  const unitCopies = new Map()
  for (const run of alleles.flat()) {
    unitCopies.set(
      run.unit,
      (unitCopies.get(run.unit) ?? 0) + run.copyBp.length,
    )
  }
  const ranked = [...unitCopies.keys()].sort(
    (a, b) =>
      unitCopies.get(b) - unitCopies.get(a) ||
      a.length - b.length ||
      a.localeCompare(b, 'en'),
  )
  const names = opts['unit-names'].split(',')
  if (names.length !== ranked.length) {
    throw new Error(
      `--unit-names gives ${names.length} names for ${ranked.length} units`,
    )
  }
  ranked.forEach((unit, i) => unitNames.set(unit, names[i]))
}

const sum = xs => xs.reduce((a, b) => a + b, 0)
const alleleBp = runs => sum(runs.map(r => sum(r.copyBp)))
const cn = bp => Number((bp / referenceBp).toFixed(4))
const info = [
  `SVLEN=${alleles.map(() => referenceBp).join(',')}`,
  `CN=${alleles.map(runs => cn(alleleBp(runs))).join(',')}`,
  `RN=${alleles.map(runs => runs.length).join(',')}`,
  `RUS=${alleles.flatMap(runs => runs.map(r => r.unit)).join(',')}`,
  ...(unitNames.size > 0
    ? [
        `RUNAME=${alleles.flatMap(runs => runs.map(r => unitNames.get(r.unit))).join(',')}`,
      ]
    : []),
  `RUC=${alleles.flatMap(runs => runs.map(r => r.copyBp.length)).join(',')}`,
  `RB=${alleles.flatMap(runs => runs.map(r => sum(r.copyBp))).join(',')}`,
  `RUB=${alleles.flatMap(runs => runs.flatMap(r => r.copyBp)).join(',')}`,
].join(';')

function genotype(calls) {
  const numbers = [...calls.keys()]
  if (numbers.length === 1 && numbers[0] === 0) {
    return {
      gt: String(calls.get(0)),
      bp: [alleleBp(alleles[calls.get(0) - 1])],
    }
  }
  const top = Math.max(2, ...numbers)
  const fields = Array.from({ length: top }, (_, k) => calls.get(k + 1))
  return {
    gt: fields.map(a => a ?? '.').join('|'),
    bp: fields.flatMap(a => (a ? [alleleBp(alleles[a - 1])] : [])),
  }
}

const names = [...samples.keys()]
const columns = names.map(name => {
  const { gt, bp } = genotype(samples.get(name))
  return `${gt}:${cn(sum(bp))}`
})
const lines = [
  '##fileformat=VCFv4.5',
  `##source=tandem-repeat-vcf.mjs ${gfaPath.split('/').at(-1)} divergence=${divergence}`,
  `##contig=<ID=${chrom}>`,
  '##ALT=<ID=CNV:TR,Description="Tandem repeat">',
  '##INFO=<ID=SVLEN,Number=A,Type=Integer,Description="Length of structural variant">',
  '##INFO=<ID=CN,Number=A,Type=Float,Description="Copy number of allele">',
  '##INFO=<ID=RN,Number=A,Type=Integer,Description="Total number of repeat sequences in this allele">',
  '##INFO=<ID=RUS,Number=.,Type=String,Description="Repeat unit sequence of the corresponding repeat sequence">',
  ...(unitNames.size > 0
    ? [
        '##INFO=<ID=RUNAME,Number=.,Type=String,Description="Name of the repeat unit of the corresponding repeat sequence">',
      ]
    : []),
  '##INFO=<ID=RUC,Number=.,Type=Float,Description="Repeat unit count of corresponding repeat sequence">',
  '##INFO=<ID=RB,Number=.,Type=Integer,Description="Total number of bases in the corresponding repeat sequence">',
  '##INFO=<ID=RUB,Number=.,Type=Integer,Description="Number of bases in each individual repeat unit">',
  '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
  '##FORMAT=<ID=CN,Number=1,Type=Float,Description="Copy number">',
  [
    '#CHROM',
    'POS',
    'ID',
    'REF',
    'ALT',
    'QUAL',
    'FILTER',
    'INFO',
    'FORMAT',
    ...names,
  ].join('\t'),
  [
    chrom,
    array.start,
    arrayName,
    referenceBase(array.start - 1),
    alleles.map(() => '<CNV:TR>').join(','),
    '.',
    '.',
    info,
    'GT:CN',
    ...columns,
  ].join('\t'),
]
process.stdout.write(`${lines.join('\n')}\n`)
