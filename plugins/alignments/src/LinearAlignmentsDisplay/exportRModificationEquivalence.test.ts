import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { BamFile } from '@gmod/bam'
import { getMethBins, getModPositions } from '@jbrowse/modifications-utils'
import { HELPERS } from '@jbrowse/plugin-linear-genome-view'
import { LocalFile } from 'generic-filehandle2'

import { forEachMaxProbMod } from '../shared/getMaxProbModAtEachPosition.ts'

import type { CytosineContext } from '@jbrowse/modifications-utils'

// One MM tag has three JBrowse readings, and each of them decides WHICH calls
// get drawn — so a helper that reads the tag correctly and then draws the wrong
// subset produces a figure showing a different amount of methylation than the
// browser did, which a reader compares against the browser and takes for
// biology. Both oracles here are the browser's own code over the same reads,
// which makes this a cross-implementation check rather than a restatement.
//
// - The threshold view and the two-color view resolve through
//   `forEachMaxProbMod`: ONE call per reference column, the most likely over
//   every MM group on the read. Drawing a tick per type instead double-draws a
//   combined code like `C+mh` at every cytosine it calls.
// - The unmarked-base fill INVENTS calls, and nothing about it is recoverable
//   from the tag alone: every cytosine in context the read covers and the tag
//   never named becomes an implicit unmodified call, and each cytosine then
//   draws whichever of 5mC / 5hmC / unmodified is most likely. Its oracle is
//   `getMethBins` plus `extractMethylation`'s winner selection, and the R has to
//   agree about the CIGAR walk, the cytosine context on both strands, which
//   reads may be filled at all ('?' vs '.' skip flags), and which of three
//   competing states wins at each column.
//
// One edge no fixture reaches: the `pmax(0, 1 - m - h)` floor, which needs a
// basecaller whose 5mC and 5hmC likelihoods sum past 1. It mirrors JBrowse's own
// `Math.max(0, …)` and nothing here makes either of them fire.
const have = (cmd: string, args: string[]) =>
  spawnSync(cmd, args, { encoding: 'utf8' }).status === 0
const HAVE_R =
  have('Rscript', ['-e', 'cat(1)']) &&
  have('Rscript', [
    '-e',
    'suppressPackageStartupMessages({library(GenomicAlignments);library(Rsamtools)})',
  ])
const maybe = HAVE_R ? test : test.skip
const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-meth-'))

interface Row {
  read: number
  pos: number
  type: string
  nomod: boolean
  prob: number
}

/** The R helpers exactly as an exported script carries them. */
function runR(
  bam: string,
  chrom: string,
  start: number,
  end: number,
  mode: string,
) {
  const script = join(dir, 'meth.R')
  writeFileSync(
    script,
    `suppressPackageStartupMessages({
  library(GenomicAlignments); library(Rsamtools)
})
${HELPERS.cytosine_context}
${HELPERS.bam_modifications}
d <- bam_modifications(${JSON.stringify(bam)}, ${JSON.stringify(chrom)}, ${start}, ${end},
                       ${mode})
if (!is.null(d) && nrow(d)) cat(paste(d$read_index, d$refpos, d$modtype,
  as.integer(d$nomod), sprintf("%.9f", d$prob), sep = "\\t"), sep = "\\n")`,
  )
  const res = spawnSync('Rscript', [script], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
  if (res.status !== 0) {
    throw new Error(`Rscript failed: ${res.stderr}`)
  }
  return res.stdout
    .split('\n')
    .filter(Boolean)
    .map(l => {
      const [read, pos, type, nomod, prob] = l.split('\t')
      return {
        read: +read!,
        pos: +pos!,
        type: type!,
        nomod: nomod === '1',
        prob: +prob!,
      } satisfies Row
    })
}

// scanBam's read order is coordinate order, which is the order getRecordsForRange
// returns too, so `read_index` lines up without either side sorting.
//
// A read overlapping the window carries its whole MM tag, and `bam_modifications`
// returns all of it — cropping to the region is the emitted script's own step
// (`mods[mods$refpos >= start & mods$refpos < end, ]` in exportRCode's coverage
// and pileup fragments), because on the cumulative multi-region axis an uncropped
// row would land inside the NEXT region's slice. So the oracle's own per-read
// crop, which is `extractMethylation`'s, is opened right up: what the two sides
// have to agree about here is every call the reads carry.
async function oracle(
  bam: string,
  chrom: string,
  start: number,
  end: number,
  context: CytosineContext,
) {
  const file = new BamFile({
    bamFilehandle: new LocalFile(bam),
    baiFilehandle: new LocalFile(`${bam}.bai`),
  })
  await file.getHeader()
  const records = await file.getRecordsForRange(chrom, start, end)
  const rows: Row[] = []
  let readIndex = 0
  for (const rec of records) {
    readIndex++
    const mm = rec.getTagAlt('MM', 'Mm') as string | undefined
    if (!mm) {
      continue
    }
    const ml = rec.getTagAlt('ML', 'Ml')
    const { seq, start: refStart } = rec
    const strand = rec.strand === -1 ? -1 : 1
    const flen = rec.end - refStart
    const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } =
      getMethBins(
        {
          modifications: getModPositions(mm, seq, strand),
          probabilities: mlBytes(ml)?.map(v => (v + 0.5) / 256),
          // already `(len << 4) | op`, which is the packing parseCigar2 emits
          cigarOps: rec.NUMERIC_CIGAR,
          seq,
          fstrand: strand,
          flen,
        },
        context,
      )
    for (let i = 0; i < flen; i++) {
      if (!methBins[i] && !hydroxyMethBins[i]) {
        continue
      }
      const m = methBins[i] ? (methProbs[i] ?? 0) : 0
      const h = hydroxyMethBins[i] ? (hydroxyMethProbs[i] ?? 0) : 0
      const none = Math.max(0, 1 - m - h)
      const isH = h > m && h > none
      const isM = !isH && m > none
      rows.push({
        read: readIndex,
        pos: i + refStart,
        type: isH ? 'h' : 'm',
        nomod: !isH && !isM,
        prob: isH ? h : isM ? m : none,
      })
    }
  }
  return rows
}

// The other two modes, whose oracle is `forEachMaxProbMod`: ONE call per
// reference column — the most likely over every MM group on the read — and then
// the threshold rule. Two-color paints the sub-even-odds half of each call in the
// unmodified color at `1 - prob` and applies no threshold at all.
async function maxProbOracle(
  bam: string,
  chrom: string,
  start: number,
  end: number,
  threshold: number,
  twoColor: boolean,
) {
  const file = new BamFile({
    bamFilehandle: new LocalFile(bam),
    baiFilehandle: new LocalFile(`${bam}.bai`),
  })
  await file.getHeader()
  const rows: Row[] = []
  let readIndex = 0
  for (const rec of await file.getRecordsForRange(chrom, start, end)) {
    readIndex++
    const mm = rec.getTagAlt('MM', 'Mm') as string | undefined
    if (!mm) {
      continue
    }
    const strand = rec.strand === -1 ? -1 : 1
    forEachMaxProbMod(
      getModPositions(mm, rec.seq, strand),
      mlBytes(rec.getTagAlt('ML', 'Ml')),
      rec.NUMERIC_CIGAR,
      strand,
      (refPos, mod, prob) => {
        if (twoColor || prob >= threshold) {
          const isMod = !twoColor || prob > 0.5
          rows.push({
            read: readIndex,
            pos: refPos + rec.start,
            type: mod.type,
            nomod: !isMod,
            prob: isMod ? prob : 1 - prob,
          })
        }
      },
    )
  }
  return rows
}

// ML reaches us as a B:C byte array from a BAM and as a comma string from SAM
// text, and the two oracles want it at different scales — raw bytes for the
// max-prob walk, the (N + 0.5) / 256 midpoints getModProbabilities applies for
// getMethBins.
function mlBytes(ml: unknown) {
  return ml === undefined
    ? undefined
    : typeof ml === 'string'
      ? ml.split(',').map(Number)
      : Array.from(ml as ArrayLike<number>, Number)
}

const key = (r: Row) => `${r.read}:${r.pos}:${r.type}:${r.nomod ? 1 : 0}`
const byKey = (rows: Row[]) => new Map(rows.map(r => [key(r), r]))

function expectSameRows(want: Row[], got: Row[]) {
  expect(got).toHaveLength(want.length)
  expect(want.length).toBeGreaterThan(0)
  const mine = byKey(got)
  for (const row of want) {
    const found = mine.get(key(row))
    // name the missing column rather than failing on a length that already
    // matched — a swapped state is the failure this is here to catch
    expect(found ? key(found) : `missing ${key(row)}`).toBe(key(row))
    expect(found!.prob).toBeCloseTo(row.prob, 6)
  }
  return got
}

async function expectEquivalent(
  bam: string,
  chrom: string,
  start: number,
  end: number,
  context: CytosineContext = 'CG',
) {
  const path = resolve(process.cwd(), bam)
  return expectSameRows(
    await oracle(path, chrom, start, end, context),
    runR(
      path,
      chrom,
      start,
      end,
      `fill_unmarked = TRUE, context = ${JSON.stringify(context)}`,
    ),
  )
}

const THRESHOLD = 0.1

async function expectMaxProbEquivalent(
  bam: string,
  chrom: string,
  start: number,
  end: number,
  twoColor: boolean,
) {
  const path = resolve(process.cwd(), bam)
  return expectSameRows(
    await maxProbOracle(path, chrom, start, end, THRESHOLD, twoColor),
    runR(
      path,
      chrom,
      start,
      end,
      `${THRESHOLD}${twoColor ? ', two_color = TRUE' : ''}`,
    ),
  )
}

// One read per orientation and per MM strand: 'C+m' assays the read's own
// strand, 'G-m' the opposite one, so the four reads between them fill forward
// and reverse cytosines of the same CpGs. None of these calls is itself in CpG
// context, which makes every drawn column a filled one.
maybe(
  'both MM strands, both read orientations',
  async () => {
    await expectEquivalent(
      'test_data/volvox/MM-orient-volvox.bam',
      'ctgA',
      0,
      50001,
    )
  },
  60000,
)

// 'C+mh' calls both types at one position with interleaved ML, so 5mC and 5hmC
// compete for the same cytosine and the winner is not always the tag's first
// type. These are also the fixtures where the two probabilities TIE: relaxing
// the winner's `>` to `>=` fails here and nowhere else.
maybe.each([
  'test_data/volvox/MM-multi-volvox.bam',
  'test_data/volvox/MM-double-volvox.bam',
  'test_data/volvox/MM-chebi-volvox.bam',
])(
  'competing types in %s',
  async bam => {
    await expectEquivalent(bam, 'ctgA', 0, 50001)
  },
  60000,
)

// soft clips: the fill walks read positions, and a clipped base has no reference
// column to land on
maybe(
  'soft-clipped reads',
  async () => {
    await expectEquivalent(
      'test_data/methylation_test/methylation_clip.bam',
      '20',
      0,
      64444167,
    )
  },
  60000,
)

// 154 real ONT reads with an explicit '.' skip flag and both 'm' and 'h' groups
// — thousands of columns where the three-way winner actually turns over. CpG
// over the whole contig; the plant contexts over a tenth of it, which is already
// tens of thousands of columns and keeps the suite inside a minute.
const ARABIDOPSIS = 'test_data/arabidopsis_methylation/arabidopsis_meth.bam'
maybe.each([
  ['CG', 0, 50000],
  ['CHG', 20000, 25000],
  ['CHH', 20000, 25000],
  ['all', 20000, 25000],
] as [CytosineContext, number, number][])(
  'a real modBAM in %s context',
  async (context, start, end) => {
    await expectEquivalent(ARABIDOPSIS, 'NC_003070.9', start, end, context)
  },
  120000,
)

// The other two modes, over the same fixtures. A combined code calls two types
// at one cytosine and only the winner is painted, so a tick per type instead
// double-draws every position the code covers — 30174 marks against the
// browser's 25154 on the arabidopsis file — and the coverage panel's stacked
// bars carry the surplus with them.
maybe.each([
  ['test_data/volvox/MM-multi-volvox.bam', 'ctgA', 0, 50001],
  ['test_data/volvox/MM-double-volvox.bam', 'ctgA', 0, 50001],
  ['test_data/volvox/MM-chebi-volvox.bam', 'ctgA', 0, 50001],
  ['test_data/volvox/MM-orient-volvox.bam', 'ctgA', 0, 50001],
  ['test_data/methylation_test/methylation_clip.bam', '20', 0, 64444167],
  [ARABIDOPSIS, 'NC_003070.9', 0, 50000],
] as [string, string, number, number][])(
  'one call per column in %s',
  async (bam, chrom, start, end) => {
    await expectMaxProbEquivalent(bam, chrom, start, end, false)
  },
  120000,
)

// Two-color draws EVERY call, flipping the ones under even odds into the
// unmodified color at their unmodified confidence. It applies no threshold —
// a low-probability call is information about the base being unmodified, not
// an absent call — so it draws strictly more columns than the default view.
maybe(
  'two-color draws both halves of every call',
  async () => {
    const win = [ARABIDOPSIS, 'NC_003070.9', 20000, 25000] as const
    const both = await expectMaxProbEquivalent(...win, true)
    const above = await expectMaxProbEquivalent(...win, false)
    expect(both.length).toBeGreaterThan(above.length)
    expect(both.some(r => r.nomod)).toBe(true)
    expect(above.some(r => r.nomod)).toBe(false)
  },
  120000,
)

// The '?' skip flag is the one input no fixture in the tree carries, and it is
// the difference between "the tag skipped this cytosine because it is
// unmodified" and "the tag says nothing about it". Rewriting the arabidopsis
// file's 'C+m.' group to 'C+m?' must stop the fill on both sides while leaving
// every genuine call — including the 'C+h.' group's, since the gate reads the
// 'm' groups and not just any group.
const HAVE_SAMTOOLS = have('samtools', ['--version'])
const maybeSam = HAVE_R && HAVE_SAMTOOLS ? test : test.skip
maybeSam(
  'the ? skip flag stops the fill',
  async () => {
    const src = resolve(process.cwd(), ARABIDOPSIS)
    const out = join(dir, 'unknown-skip.bam')
    const sh = `set -e
samtools view -h '${src}' | sed 's/C+m\\./C+m?/g' | samtools view -b -o '${out}' -
samtools index '${out}'`
    const res = spawnSync('sh', ['-c', sh], { encoding: 'utf8' })
    if (res.status !== 0) {
      throw new Error(`could not rewrite the skip flag: ${res.stderr}`)
    }
    const filled = await oracle(src, 'NC_003070.9', 0, 50000, 'CG')
    const unknown = await expectEquivalent(out, 'NC_003070.9', 0, 50000)
    // the point of the rewrite: far fewer columns, and every one of them a column
    // the filled run also drew — nothing new, only the invented ones gone
    expect(unknown.length).toBeLessThan(filled.length / 2)
    const drawn = new Set(filled.map(key))
    expect(unknown.filter(r => !drawn.has(key(r)))).toHaveLength(0)
  },
  120000,
)
