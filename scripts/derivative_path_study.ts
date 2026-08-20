#!/usr/bin/env node
/**
 * Batch agreement study for `Reconstruct derivative allele...`.
 *
 * The feature's fixtures are hand-picked loci: they say the reconstruction gets
 * the der(3), the chr9 fold-back and the HG008-T chromoplexy right, and they
 * cannot say how it behaves over a whole callset. This runs it at EVERY
 * junction a somatic caller reports, plus two control sets, and reports what
 * fraction it recovers and where it ranks them.
 *
 * WHAT THIS DOES AND DOES NOT MEASURE. The comparator (nanomonsv's calls) was
 * derived from the same molecules the picker reads, so agreement here is
 * CONCORDANCE between two methods on one dataset, not validation against an
 * independent truth. The two are still doing different work -- nanomonsv
 * clusters, assembles a local contig and subtracts a matched normal, while this
 * reads SA tags off single reads and subtracts nothing -- so disagreement is
 * informative in both directions. The independent checks live elsewhere: the
 * HG008-T fixture is scored against a benchmark callset AND a T2T tumour
 * assembly built without reads.
 *
 * Two stages, because the fetch is the slow part and the scoring is what you
 * iterate on:
 *
 *   node --experimental-strip-types scripts/derivative_path_study.ts fetch
 *   node --experimental-strip-types scripts/derivative_path_study.ts score
 *
 * `fetch` writes a corpus of SAM records per locus; `score` runs the real
 * `computeReadChains` + `computeDerivativePaths` over it, at several window
 * sizes and parameter settings, and prints the tables. The corpus is fetched at
 * the widest window so every narrower one is a filter rather than a refetch.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { pileupDataFromSamRecords } from '../plugins/alignments/src/LinearAlignmentsDisplay/testUtils.ts'
import { computeReadChains } from '../plugins/alignments/src/features/arcs/arcChains.ts'
import { computeDerivativePaths } from '../plugins/alignments/src/features/derivativePaths/computePaths.ts'

import type { SamRecordFixture } from '../plugins/alignments/src/LinearAlignmentsDisplay/testUtils.ts'
import type { DerivativeCandidate } from '../plugins/alignments/src/features/derivativePaths/computePaths.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = '/home/cdiesh/fusion_demo_build'
const REF = join(DATA, 'GRCh38.fa')

interface Source {
  url: string
  index: string
  isCram?: boolean
}
interface Dataset {
  vcf: string
  comparator: string
  /** whether the comparator saw these same reads */
  independent: boolean
  tumour: Source
  normal: Source
}

// Two cancers, two chemistries, and two comparators that differ in the way that
// matters most: who produced them.
const DATASETS: Record<string, Dataset> = {
  // The tutorial's dataset. nanomonsv's calls came off these same molecules, so
  // this measures CONCORDANCE between two methods on one read set, not
  // validation against an independent truth.
  colo829: {
    vcf: join(DATA, 'demo/COLO829.somatic-sv.vcf.gz'),
    comparator: 'nanomonsv somatic calls (PASS)',
    independent: false,
    tumour: {
      url: 'https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram',
      index: join(DATA, 'COLO829_tumor.ht.cram.crai'),
      isCram: true,
    },
    normal: {
      url: 'https://ont-open-data.s3.amazonaws.com/colo829_2024.03/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam',
      index: join(DATA, 'PAU59807.d052sup4305mCG_5hmCGvHg38.bam.bai'),
    },
  },
  // The independent one. C-GIAB's draft somatic benchmark is GIAB's own product,
  // built from several technologies and from assemblies rather than from this
  // BAM, so agreement here is not the picker being graded on its own homework.
  cgiab: {
    vcf: 'https://jbrowse.org/genomes/GRCh38/cgiab/GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz',
    comparator: 'C-GIAB V0.5 draft somatic SV benchmark (PASS)',
    independent: true,
    tumour: {
      url: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam',
      index:
        'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam.bai',
    },
    normal: {
      url: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.bam',
      index:
        'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.bam.bai',
    },
  },
}

// The corpus is fetched this wide; `score` evaluates narrower windows by
// filtering it, so window size costs nothing to sweep.
const FETCH_HALF_WIDTH = 10_000
const WINDOW_HALF_WIDTHS = [2_500, 5_000, 10_000]

// How close a proposed junction has to be to the called one to count as the
// same junction. Generous on purpose: which base a breakend names is a
// convention, and microhomology moves it by tens of bp. The distance itself is
// reported, so the reader can see what the number is buying.
const MATCH_BP = 100

const CORPUS_ROOT = join(HERE, '..', '.derivative-study')
const corpusDir = (dataset: string) => join(CORPUS_ROOT, dataset)

interface CalledJunction {
  id: string
  svType: string
  aRef: string
  aPos: number // 0-based
  bRef: string
  bPos: number // 0-based
  /** bp between the two ends, or undefined when interchromosomal */
  span?: number
}

interface Locus {
  key: string
  /** which junction this window is about, absent for a random control */
  junction?: CalledJunction
  refName: string
  start: number
  end: number
}

interface Corpus {
  loci: Locus[]
  records: Record<string, SamRecordFixture[]>
}

// ---------------------------------------------------------------- fetch stage

function bcftoolsJunctions(vcf: string): CalledJunction[] {
  const out = execFileSync(
    'bcftools',
    [
      'query',
      '-i',
      'FILTER="PASS"',
      '-f',
      '%ID\t%CHROM\t%POS\t%ALT\t%INFO/SVTYPE\t%INFO/MATEID\t%INFO/END\n',
      vcf,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  )
  const junctions: CalledJunction[] = []
  const seenMate = new Set<string>()
  for (const line of out.trim().split('\n')) {
    const [id, chrom, pos, alt, svType, mateId] = line.split('\t')
    const end = line.split('\t')[6]
    if (!id || !chrom || !pos || !svType) {
      continue
    }
    // An insertion has no second locus, so there is no path to reconstruct. The
    // feature is about routes through the reference and says so; counting these
    // as misses would be scoring it against a claim it does not make.
    if (svType === 'INS') {
      continue
    }
    if (svType === 'BND') {
      // A reciprocal pair is one adjacency written twice. Keep the first
      // spelling and skip its mate, or every junction is counted twice.
      if (seenMate.has(id)) {
        continue
      }
      if (mateId && mateId !== '.') {
        seenMate.add(mateId)
      }
      const m = /[[\]]([^[\]:]+):(\d+)[[\]]/.exec(alt ?? '')
      if (!m) {
        continue
      }
      // Callers write the mate refName in whatever case they like, so the
      // COMPARISON has to fold case (`sameRef`). The spelling stored here is
      // the VCF's own, because it is also what gets fetched: folding it here
      // instead is the exact trap SV_MULTIHOP.md records against sv_multihop's
      // `--loci`, and it cost this study six chrX loci before it was caught.
      const bRef = m[1]!
      const aRef = chrom
      const aPos = +pos - 1
      const bPos = +m[2]! - 1
      junctions.push({
        id,
        svType,
        aRef,
        aPos,
        bRef,
        bPos,
        ...(sameRef(aRef, bRef) ? { span: Math.abs(bPos - aPos) } : {}),
      })
    } else if (end && end !== '.') {
      const ref = chrom
      const aPos = +pos - 1
      const bPos = +end - 1
      junctions.push({
        id,
        svType,
        aRef: ref,
        aPos,
        bRef: ref,
        bPos,
        span: Math.abs(bPos - aPos),
      })
    }
  }
  return junctions
}

// A control set matched to the positive set in everything but the locus: same
// file, same window size, same depth regime, no called event. Sampled with a
// fixed seed so a rerun scores the same places.
function randomLoci(source: Source, n: number, seed = 20260811): Locus[] {
  // Contig names and lengths come from the ALIGNMENT FILE's own header, not
  // from a reference .fai. Two reasons: it removes the last local-data
  // dependency for a BAM-only dataset, and it makes the control loci come from
  // exactly the naming universe the reads use, which is the class of bug that
  // cost this study six chrX loci on its first run.
  const header = execFileSync(
    'samtools',
    ['view', '-H', '-X', source.url, source.index],
    {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  )
  const chroms: { name: string; len: number }[] = []
  for (const line of header.split('\n')) {
    if (!line.startsWith('@SQ')) {
      continue
    }
    const name = /SN:(\S+)/.exec(line)?.[1]
    const len = /LN:(\d+)/.exec(line)?.[1]
    // primary chromosomes only: an unplaced contig is a study of mismapping,
    // which the fixtures already characterize
    if (name && len && /^chr(\d+)$/.test(name)) {
      chroms.push({ name, len: +len })
    }
  }
  let state = seed
  const rand = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
  const loci: Locus[] = []
  for (let i = 0; i < n; i++) {
    const c = chroms[Math.floor(rand() * chroms.length)]!
    // stay clear of the telomeres, where the mismapping the fixtures already
    // characterize would make this a study of terminal repeats instead
    const pos = 5_000_000 + Math.floor(rand() * Math.max(1, c.len - 10_000_000))
    loci.push({
      key: `random_${i}`,
      refName: c.name,
      start: Math.max(0, pos - FETCH_HALF_WIDTH),
      end: pos + FETCH_HALF_WIDTH,
    })
  }
  return loci
}

function locusOf(j: CalledJunction): Locus {
  return {
    key: j.id,
    junction: j,
    refName: j.aRef,
    start: Math.max(0, j.aPos - FETCH_HALF_WIDTH),
    end: j.aPos + FETCH_HALF_WIDTH,
  }
}

function samFetch(
  dataset: string,
  source: Source,
  loci: Locus[],
): Record<string, SamRecordFixture[]> {
  const isCram = !!source.isCram
  const bed = join(corpusDir(dataset), 'windows.bed')
  writeFileSync(
    bed,
    `${loci.map(l => `${l.refName}\t${l.start}\t${l.end}`).join('\n')}\n`,
  )
  const args = [
    'view',
    '-F',
    '1540',
    '-M',
    '-L',
    bed,
    ...(isCram
      ? ['-T', REF, '--input-fmt-option', 'required_fields=0x87F']
      : []),
    '-X',
    source.url,
    source.index,
  ]
  // Project away SEQ and QUAL before the output ever reaches node. They are
  // over 95% of a SAM line and nothing here reads them: 116x HiFi over 152
  // windows is ~700 MB of bases that only served to overflow node's maximum
  // string length (ERR_STRING_TOO_LONG), against ~4 MB of the six fields a
  // chain is actually built from. The awk also finds SA:Z: wherever the aligner
  // put it, which is why the tag cannot simply be `cut`.
  const project =
    'awk \'BEGIN{OFS="\\t"} {sa=""; for(i=12;i<=NF;i++) if($i ~ /^SA:Z:/) sa=substr($i,6); print $1,$2,$3,$4,$6,sa}\''
  const quoted = args.map(a => `'${a.replaceAll("'", `'\\''`)}'`).join(' ')
  const sam = execFileSync('sh', ['-c', `samtools ${quoted} | ${project}`], {
    encoding: 'utf8',
    maxBuffer: 1 << 30,
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  const byRef = new Map<string, Locus[]>()
  for (const l of loci) {
    let list = byRef.get(l.refName)
    if (!list) {
      list = []
      byRef.set(l.refName, list)
    }
    list.push(l)
  }
  const out: Record<string, SamRecordFixture[]> = {}
  for (const l of loci) {
    out[l.key] = []
  }
  for (const line of sam.split('\n')) {
    if (!line) {
      continue
    }
    // the six columns `project` emits, in that order
    const [name, flagStr, rname, posStr, cigar, sa = ''] = line.split('\t')
    if (!name || !rname || !cigar || cigar === '*') {
      continue
    }
    const flag = +flagStr!
    const pos = +posStr!
    const rec: SamRecordFixture = {
      name,
      flag,
      strand: flag & 16 ? -1 : 1,
      pos,
      CIGAR: cigar,
      SA: sa,
    }
    const span = refSpan(cigar)
    for (const l of byRef.get(rname) ?? []) {
      if (pos - 1 < l.end && pos - 1 + span > l.start) {
        out[l.key]!.push(rec)
      }
    }
  }
  return out
}

function refSpan(cigar: string) {
  let n = 0
  let total = 0
  for (const ch of cigar) {
    if (ch >= '0' && ch <= '9') {
      n = n * 10 + +ch
    } else {
      if (ch === 'M' || ch === 'D' || ch === 'N' || ch === '=' || ch === 'X') {
        total += n
      }
      n = 0
    }
  }
  return total
}

// Progress goes to a file as well as stderr: the fetch runs for many minutes
// against remote files, and stderr through a pipe does not arrive until exit,
// which is exactly when the progress stops being useful.
let progressFile = ''
function say(msg: string) {
  process.stderr.write(`${msg}\n`)
  if (progressFile) {
    appendFileSync(progressFile, `${new Date().toISOString()} ${msg}\n`)
  }
}

function fetch(dataset: string) {
  const ds = DATASETS[dataset]!
  const dir = corpusDir(dataset)
  mkdirSync(dir, { recursive: true })
  progressFile = join(dir, 'progress.log')

  let vcf = ds.vcf
  if (vcf.startsWith('http')) {
    vcf = join(dir, 'comparator.vcf.gz')
    execFileSync('curl', ['-sL', '-o', vcf, ds.vcf])
    execFileSync('tabix', ['-f', '-p', 'vcf', vcf])
  }
  const junctions = bcftoolsJunctions(vcf)
  const called = junctions.map(locusOf)
  const random = randomLoci(ds.tumour, 60)
  say(
    `${dataset}: ${junctions.length} called junctions, ${random.length} random control loci`,
  )

  // Each stage is written as it lands rather than at the end: a remote fetch
  // that dies in stage three should not throw away stages one and two.
  const stages: [string, Source, Locus[]][] = [
    ['tumour_called', ds.tumour, called],
    ['normal_called', ds.normal, called],
    ['tumour_random', ds.tumour, random],
  ]
  for (const [name, source, loci] of stages) {
    say(`fetching ${name}...`)
    const corpus: Corpus = {
      loci,
      records: samFetch(dataset, source, loci),
    }
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(corpus))
    const n = Object.values(corpus.records).reduce((a, r) => a + r.length, 0)
    say(`  ${name}: ${n} records over ${loci.length} loci`)
  }
}

// ---------------------------------------------------------------- score stage

/** Every junction a candidate route asserts, as the picker's own edges. */
function junctionsOf(candidate: DerivativeCandidate) {
  const out: { aRef: string; aPos: number; bRef: string; bPos: number }[] = []
  const segs = candidate.segments
  for (let i = 0; i < segs.length - 1; i++) {
    const a = segs[i]!
    const b = segs[i + 1]!
    out.push({
      aRef: a.refName,
      // the edge the path LEAVES a by, and the edge it ENTERS b by. Never the
      // flanked outer edges, which is what makes these comparable to a call.
      aPos: a.strand === -1 ? a.start : a.end,
      bRef: b.refName,
      bPos: b.strand === -1 ? b.end : b.start,
    })
  }
  return out
}

const sameRef = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * How many reads carry this junction INSIDE one alignment, as a CIGAR deletion
 * of about the called length at about the called place.
 *
 * This is what turns "small events are missed" from an observation into a
 * mechanism. A method reading SA tags sees a junction only when the aligner
 * chose to split the read at it, and an aligner represents a short deletion as
 * a `D` op instead. Where this count is high and the route count is zero, the
 * event is in the data, is not a chain, and could not have been recovered by
 * anything reading chains -- which is a statement about the input, not about
 * the grouping.
 */
function cigarDeletionSupport(records: SamRecordFixture[], j: CalledJunction) {
  if (j.span === undefined) {
    return 0
  }
  const lo = j.span * 0.8
  const hi = j.span * 1.2
  let n = 0
  for (const rec of records) {
    let pos = rec.pos - 1
    let len = 0
    let hit = false
    for (const ch of rec.CIGAR) {
      if (ch >= '0' && ch <= '9') {
        len = len * 10 + +ch
      } else {
        if (ch === 'D' || ch === 'N') {
          if (
            len >= lo &&
            len <= hi &&
            Math.abs(pos - j.aPos) <= 5 * MATCH_BP
          ) {
            hit = true
          }
        }
        if (
          ch === 'M' ||
          ch === 'D' ||
          ch === 'N' ||
          ch === '=' ||
          ch === 'X'
        ) {
          pos += len
        }
        len = 0
      }
    }
    if (hit) {
      n++
    }
  }
  return n
}

/** Distance from a called junction to the nearest junction this route asserts. */
function distanceTo(candidate: DerivativeCandidate, j: CalledJunction) {
  let best = Infinity
  for (const c of junctionsOf(candidate)) {
    // a junction is unordered: the route may cross it either way round
    const forward =
      sameRef(c.aRef, j.aRef) && sameRef(c.bRef, j.bRef)
        ? Math.max(Math.abs(c.aPos - j.aPos), Math.abs(c.bPos - j.bPos))
        : Infinity
    const backward =
      sameRef(c.bRef, j.aRef) && sameRef(c.aRef, j.bRef)
        ? Math.max(Math.abs(c.bPos - j.aPos), Math.abs(c.aPos - j.bPos))
        : Infinity
    best = Math.min(best, forward, backward)
  }
  return best
}

interface Scored {
  key: string
  junction?: CalledJunction
  reads: number
  chains: number
  candidates: number
  /** 1-based rank of the first route carrying the called junction, 0 if none */
  rank: number
  distance: number
  /** reads carrying this junction as a CIGAR deletion rather than as a chain */
  inCigar: number
}

function scoreLocus(
  locus: Locus,
  records: SamRecordFixture[],
  halfWidth: number,
  opts: { tolerance?: number; minReads?: number },
): Scored {
  const mid = Math.floor((locus.start + locus.end) / 2)
  const start = Math.max(0, mid - halfWidth)
  const end = mid + halfWidth
  const inWindow = records.filter(
    r => r.pos - 1 < end && r.pos - 1 + refSpan(r.CIGAR) > start,
  )
  const data = pileupDataFromSamRecords(inWindow)
  const chains = computeReadChains(
    [new Map([[0, data]])],
    [{ refName: locus.refName, start, end, displayedRegionIndex: 0 }],
  )
  const candidates = computeDerivativePaths({ chains, ...opts })
  let rank = 0
  let distance = Infinity
  if (locus.junction) {
    for (const [i, c] of candidates.entries()) {
      const d = distanceTo(c, locus.junction)
      if (d < distance) {
        distance = d
      }
      if (rank === 0 && d <= MATCH_BP) {
        rank = i + 1
      }
    }
  }
  return {
    key: locus.key,
    ...(locus.junction ? { junction: locus.junction } : {}),
    reads: inWindow.length,
    chains: chains.length,
    candidates: candidates.length,
    rank,
    distance,
    inCigar: locus.junction
      ? cigarDeletionSupport(inWindow, locus.junction)
      : 0,
  }
}

function load(dataset: string, name: string): Corpus {
  return JSON.parse(
    readFileSync(join(corpusDir(dataset), `${name}.json`), 'utf8'),
  )
}

function scoreAll(
  corpus: Corpus,
  halfWidth: number,
  opts: { tolerance?: number; minReads?: number } = {},
) {
  return corpus.loci.map(l =>
    scoreLocus(l, corpus.records[l.key] ?? [], halfWidth, opts),
  )
}

function pct(a: number, b: number) {
  return b === 0 ? 'n/a' : `${((100 * a) / b).toFixed(0)}%`
}

// Event size is the covariate the whole study turns on: an aligner keeps a
// small deletion inside one read's CIGAR and only emits a supplementary
// alignment once the event is big enough, so a method reading SA tags cannot
// see the small ones and should not be scored as though it could.
const SIZE_BINS = [
  { label: '< 1 kb', lo: 0, hi: 1_000 },
  { label: '1 - 10 kb', lo: 1_000, hi: 10_000 },
  { label: '10 - 100 kb', lo: 10_000, hi: 100_000 },
  { label: '> 100 kb', lo: 100_000, hi: Infinity },
  { label: 'interchromosomal', lo: -1, hi: -1 },
]

function binOf(j: CalledJunction) {
  if (j.span === undefined) {
    return 'interchromosomal'
  }
  return SIZE_BINS.find(b => j.span! >= b.lo && j.span! < b.hi)!.label
}

function report(dataset: string) {
  const ds = DATASETS[dataset]!
  const tumour = load(dataset, 'tumour_called')
  const normal = load(dataset, 'normal_called')
  const random = load(dataset, 'tumour_random')

  console.log(`# ${dataset}: derivative-allele reconstruction vs a callset\n`)
  console.log(
    `Comparator: ${ds.comparator}, ${ds.independent ? 'INDEPENDENT of these reads' : 'derived from these same reads'}.`,
  )
  console.log(
    `${tumour.loci.length} junctions, insertions excluded. A junction counts as`,
  )
  console.log(
    `recovered when a proposed route asserts it with both ends within ${MATCH_BP} bp.\n`,
  )

  const main = scoreAll(tumour, 5_000)
  const recovered = main.filter(s => s.rank > 0)
  console.log('## Recall by event size, 10 kb window\n')
  console.log(
    '| Event size | Junctions | Recovered | Top-ranked | Median reads |',
  )
  console.log('| --- | --- | --- | --- | --- |')
  for (const bin of SIZE_BINS) {
    const rows = main.filter(s => s.junction && binOf(s.junction) === bin.label)
    if (rows.length === 0) {
      continue
    }
    const got = rows.filter(s => s.rank > 0)
    const top = got.filter(s => s.rank === 1)
    const reads = rows.map(s => s.reads).sort((a, b) => a - b)
    console.log(
      `| ${bin.label} | ${rows.length} | ${got.length} (${pct(got.length, rows.length)}) | ${top.length} | ${reads[reads.length >> 1] ?? 0} |`,
    )
  }
  console.log(
    `| **all** | **${main.length}** | **${recovered.length} (${pct(recovered.length, main.length)})** | **${recovered.filter(s => s.rank === 1).length}** | |\n`,
  )

  console.log('## Where the recovered junctions rank\n')
  const ranks = recovered.map(s => s.rank).sort((a, b) => a - b)
  const atK = (k: number) => ranks.filter(r => r <= k).length
  console.log('| Rank | Cumulative |')
  console.log('| --- | --- |')
  for (const k of [1, 2, 3, 5, 10]) {
    console.log(`| top ${k} | ${atK(k)} of ${recovered.length} |`)
  }
  const dists = recovered.map(s => s.distance).sort((a, b) => a - b)
  console.log(
    `\nBreakpoint agreement, worst end of each recovered junction: median ${dists[dists.length >> 1]} bp, max ${dists[dists.length - 1]} bp.\n`,
  )

  console.log('## Controls\n')
  const normalScores = scoreAll(normal, 5_000)
  const randomScores = scoreAll(random, 5_000)
  console.log(
    '| Set | Loci | Loci proposing any route | Routes per locus (mean) |',
  )
  console.log('| --- | --- | --- | --- |')
  for (const [label, rows] of [
    ['tumour, at called junctions', main],
    ['matched normal, same windows', normalScores],
    ['tumour, random loci', randomScores],
  ] as [string, Scored[]][]) {
    const any = rows.filter(s => s.candidates > 0)
    const mean = rows.reduce((a, s) => a + s.candidates, 0) / rows.length
    console.log(
      `| ${label} | ${rows.length} | ${any.length} (${pct(any.length, rows.length)}) | ${mean.toFixed(2)} |`,
    )
  }
  const normalRecovered = normalScores.filter(s => s.rank > 0)
  console.log(
    `\nThe matched normal recovers ${normalRecovered.length} of the ${main.length} somatic junctions, which is the somatic control.\n`,
  )

  console.log('## Window size\n')
  console.log('| Window | Recovered | Top-ranked | Routes per locus (mean) |')
  console.log('| --- | --- | --- | --- |')
  for (const hw of WINDOW_HALF_WIDTHS) {
    const rows = scoreAll(tumour, hw)
    const got = rows.filter(s => s.rank > 0)
    const mean = rows.reduce((a, s) => a + s.candidates, 0) / rows.length
    console.log(
      `| ${(2 * hw) / 1000} kb | ${got.length} (${pct(got.length, rows.length)}) | ${got.filter(s => s.rank === 1).length} | ${mean.toFixed(2)} |`,
    )
  }

  console.log('\n## Parameter sensitivity\n')
  console.log(
    '| tolerance | minReads | Recovered | Routes per locus, tumour | ...random |',
  )
  console.log('| --- | --- | --- | --- | --- |')
  for (const tolerance of [5, 10, 20, 50, 100]) {
    for (const minReads of [1, 2, 3]) {
      const rows = scoreAll(tumour, 5_000, { tolerance, minReads })
      const rnd = scoreAll(random, 5_000, { tolerance, minReads })
      const got = rows.filter(s => s.rank > 0)
      const mean = rows.reduce((a, s) => a + s.candidates, 0) / rows.length
      const rmean = rnd.reduce((a, s) => a + s.candidates, 0) / rnd.length
      console.log(
        `| ${tolerance} | ${minReads} | ${got.length} (${pct(got.length, rows.length)}) | ${mean.toFixed(2)} | ${rmean.toFixed(2)} |`,
      )
    }
  }

  console.log('\n## Junctions not recovered\n')
  console.log(
    '| id | type | span | reads | chains | routes | nearest route | in CIGAR |',
  )
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |')
  const missed = main.filter(x => x.rank === 0)
  for (const s of missed) {
    const j = s.junction!
    console.log(
      `| ${s.key} | ${j.svType} | ${j.span === undefined ? 'interchrom' : j.span} | ${s.reads} | ${s.chains} | ${s.candidates} | ${s.distance === Infinity ? 'none' : `${s.distance} bp`} | ${s.inCigar} |`,
    )
  }
  const explained = missed.filter(s => s.inCigar > 0)
  console.log(
    `\n${explained.length} of the ${missed.length} misses are carried by reads as a CIGAR deletion`,
  )
  console.log(
    `instead of a split alignment, so no method reading SA chains could reach them.`,
  )
  const unexplained = missed.filter(s => s.inCigar === 0 && s.reads > 0)
  console.log(
    `${unexplained.length} are missed with reads present and no in-read deletion either.`,
  )
  console.log(
    `${missed.filter(s => s.reads === 0).length} had no reads in the window at all.\n`,
  )
}

const cmd = process.argv[2]
const dataset = process.argv[3] ?? 'colo829'
if (!DATASETS[dataset]) {
  process.stderr.write(`unknown dataset ${dataset}\n`)
  process.exit(2)
}
if (cmd === 'fetch') {
  fetch(dataset)
} else if (cmd === 'score') {
  report(dataset)
} else {
  process.stderr.write(
    `usage: derivative_path_study.ts fetch|score [${Object.keys(DATASETS).join('|')}]\n`,
  )
  process.exit(2)
}
