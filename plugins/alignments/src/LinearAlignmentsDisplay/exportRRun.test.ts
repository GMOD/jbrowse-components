import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { alignmentsFragments } from './exportRCode.ts'

// Only run when R + the Bioconductor alignment stack are installed (skipped in
// CI). Executes the *real* generated script so a codegen change that emits
// invalid or non-running R fails the test.
function rWithAlignmentStack() {
  const probe = spawnSync(
    'Rscript',
    [
      '-e',
      'cat(requireNamespace("GenomicAlignments", quietly = TRUE) && requireNamespace("Rsamtools", quietly = TRUE))',
    ],
    { encoding: 'utf8' },
  )
  return probe.status === 0 && probe.stdout.trim() === 'TRUE'
}

const maybe = rWithAlignmentStack() ? test : test.skip

maybe('generated alignments R script runs and produces a figure', () => {
  const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
  const fragments = alignmentsFragments({
    trackId: 'aln',
    trackName: 'Volvox reads',
    uri: bam,
    showCoverage: true,
    showPileup: true,
    colorBy: 'normal',
    showLowFreqMismatches: false,
  })
  const script = assembleRScript({ refName: 'ctgA', start: 0, end: 5000 }, fragments)

  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-bam-'))
  const scriptPath = join(dir, 'view.R')
  writeFileSync(scriptPath, script)

  execFileSync('Rscript', [scriptPath], { cwd: dir, stdio: 'pipe' })

  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
}, 90000)

// exercise every color-by scheme's read_fill_colors branch (incl. the MAPQ hue
// ramp + insert-size stats) through the real generated script
maybe('generated script runs for each color-by scheme', () => {
  const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
  for (const colorBy of ['normal', 'strand', 'mappingQuality', 'insertSize']) {
    const fragments = alignmentsFragments({
      trackId: 'aln',
      trackName: 'Volvox reads',
      uri: bam,
      showCoverage: false,
      showPileup: true,
      colorBy,
      showLowFreqMismatches: false,
    })
    const script = assembleRScript(
      { refName: 'ctgA', start: 0, end: 5000 },
      fragments,
    )
    const dir = mkdtempSync(join(tmpdir(), `jb-rexport-color-${colorBy}-`))
    const scriptPath = join(dir, 'view.R')
    writeFileSync(scriptPath, script)
    execFileSync('Rscript', [scriptPath], { cwd: dir, stdio: 'pipe' })
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
  }
}, 120000)

// the MD-tag mismatch walk is the accuracy-critical part; run it directly and
// assert it finds the real C-SNP at ctgA:1693 (~20 reads) that pileup() confirms
maybe('bam_mismatches finds the known SNP column, reference-free', () => {
  const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
  const [fragment] = alignmentsFragments({
    trackId: 'aln',
    trackName: 'Volvox reads',
    uri: bam,
    showCoverage: true,
    showPileup: false,
    colorBy: 'normal',
    showLowFreqMismatches: false,
  })
  // emit only the helper defs, then probe bam_mismatches over the SNP region
  const helpers = assembleRScript({ refName: 'ctgA', start: 0, end: 1 }, [
    fragment!,
  ])
    .split('# Data sources')[0]!
  const probe = `${helpers}
mm <- bam_mismatches(${JSON.stringify(bam)}, "ctgA", 1600, 1800)
snp <- aggregate(read_index ~ refpos + base, data = mm, FUN = length)
top <- snp[which.max(snp$read_index), ]
cat(top$refpos, as.character(top$base), top$read_index, "\\n")
`
  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-mm-'))
  const scriptPath = join(dir, 'probe.R')
  writeFileSync(scriptPath, probe)
  const out = execFileSync('Rscript', [scriptPath], {
    cwd: dir,
    encoding: 'utf8',
  }).trim()
  const [refpos, altBase, count] = out.split(/\s+/)
  expect(refpos).toBe('1693')
  expect(altBase).toBe('C')
  expect(Number(count)).toBeGreaterThanOrEqual(15)
}, 90000)
