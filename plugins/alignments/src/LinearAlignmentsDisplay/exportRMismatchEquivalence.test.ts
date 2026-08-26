import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { HELPERS } from '@jbrowse/plugin-linear-genome-view'

// MD is OPTIONAL in BAM — plenty of aligners never write it and `samtools calmd`
// is a separate pass — so an MD-only mismatch walk draws a pileup with no SNP
// ticks on those files and says nothing about it. JBrowse's own adapter takes
// two paths for exactly this reason (BamAdapter's `needsReference`,
// `seqFetchSpan`), and `bam_mismatches` has to take the same two.
//
// The oracle is the MD tag itself: run the helper over a BAM that carries MD,
// then over a copy with MD stripped plus a reference, and require the same
// mismatches. Anything the reference path gets wrong — an off-by-one in the
// projection, a deletion counted as a mismatch, the wrong reference offset —
// shows up as a row the MD path does not have.
function have(cmd: string, args: string[]) {
  return spawnSync(cmd, args, { encoding: 'utf8' }).status === 0
}
const BAM = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
const FASTA = resolve(process.cwd(), 'test_data/volvox/volvox.fa')
const TWOBIT = resolve(process.cwd(), 'test_data/volvox/volvox.2bit')
const HAVE_R =
  have('Rscript', ['-e', 'cat(1)']) &&
  have('Rscript', [
    '-e',
    'suppressPackageStartupMessages({library(GenomicAlignments);library(Rsamtools);library(rtracklayer)})',
  ])
const HAVE_SAMTOOLS = have('samtools', ['--version'])
const maybe =
  HAVE_R && HAVE_SAMTOOLS && existsSync(BAM) && existsSync(FASTA)
    ? test
    : test.skip

const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-mm-'))

function strippedBam() {
  const out = join(dir, 'nomd.bam')
  const sh = `set -e
samtools view -h '${BAM}' | sed 's/\\tMD:Z:[^\\t]*//' | samtools view -b -o '${out}' -
samtools index '${out}'`
  const res = spawnSync('sh', ['-c', sh], { encoding: 'utf8' })
  if (res.status !== 0) {
    throw new Error(`could not strip MD: ${res.stderr}`)
  }
  return out
}

// The helpers exactly as an exported script carries them, so the test cannot
// pass against a copy that has drifted from what jb2export emits.
function run(body: string) {
  const script = join(dir, 'mm.R')
  writeFileSync(
    script,
    `suppressPackageStartupMessages({
  library(GenomicAlignments); library(Rsamtools)
})
${HELPERS.open_reference}
${HELPERS.bam_mismatches}
key <- function(d) if (is.null(d) || !nrow(d)) character(0) else
  sort(paste(d$read_index, d$refpos, toupper(d$base)))
${body}`,
  )
  const res = spawnSync('Rscript', [script], { encoding: 'utf8' })
  if (res.status !== 0) {
    throw new Error(`Rscript failed: ${res.stderr}`)
  }
  return res.stdout.trim().split('\n')
}

maybe(
  'a read with no MD gets the same mismatches from the reference as from its MD tag',
  () => {
    const nomd = strippedBam()
    const [md, fa, twobit, faEq, twobitEq] = run(`
viaMD <- bam_mismatches('${BAM}', 'ctgA', 0, 2000)
viaFa <- bam_mismatches('${nomd}', 'ctgA', 0, 2000, '${FASTA}')
via2b <- bam_mismatches('${nomd}', 'ctgA', 0, 2000, '${TWOBIT}')
cat(nrow(viaMD), nrow(viaFa), nrow(via2b),
    identical(key(viaFa), key(viaMD)), identical(key(via2b), key(viaMD)), sep='\\n')`)
    // a real number of them, so "equal" can't be two empty sets
    expect(Number(md)).toBeGreaterThan(100)
    expect(fa).toBe(md)
    expect(twobit).toBe(md)
    expect(faEq).toBe('TRUE')
    // 2bit as well as FASTA: an assembly stored as 2bit used to resolve to no
    // reference at all, which is a pileup with no ticks on every MD-less read
    expect(twobitEq).toBe('TRUE')
  },
  180000,
)

maybe(
  'with no reference the MD-less reads simply contribute nothing',
  () => {
    const nomd = strippedBam()
    const [rows] = run(
      `d <- bam_mismatches('${nomd}', 'ctgA', 0, 2000)\ncat(if (is.null(d)) 0 else nrow(d))`,
    )
    // Not an error and not a wrong answer — the exporter names this in the
    // script's header instead (see the note in exportRCode.ts).
    expect(rows).toBe('0')
  },
  180000,
)
