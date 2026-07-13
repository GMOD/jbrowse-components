import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { alignmentsFragments } from './exportRCode.ts'

const baseParams = {
  isCram: false,
  reference: '',
  linkReads: false,
  showLowFreqMismatches: false,
  modificationThreshold: 0.1,
}

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

// CRAM decoding shells out to samtools (Rsamtools can't read CRAM), so the CRAM
// test additionally needs samtools on PATH.
function haveSamtools() {
  return spawnSync('samtools', ['--version'], { encoding: 'utf8' }).status === 0
}

const maybe = rWithAlignmentStack() ? test : test.skip
const maybeCram =
  rWithAlignmentStack() && haveSamtools() ? test : test.skip

maybe('generated alignments R script runs and produces a figure', () => {
  const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
  const fragments = alignmentsFragments({
    ...baseParams,
    trackId: 'aln',
    trackName: 'Volvox reads',
    uri: bam,
    showCoverage: true,
    showPileup: true,
    colorBy: 'normal',
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
  for (const colorBy of [
    'normal',
    'strand',
    'mappingQuality',
    'insertSize',
    'pairOrientation',
  ]) {
    const fragments = alignmentsFragments({
      ...baseParams,
      trackId: 'aln',
      trackName: 'Volvox reads',
      uri: bam,
      showCoverage: false,
      showPileup: true,
      colorBy,
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
    ...baseParams,
    trackId: 'aln',
    trackName: 'Volvox reads',
    uri: bam,
    showCoverage: true,
    showPileup: false,
    colorBy: 'normal',
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

// the MM/ML modification parse is the other accuracy-critical walk; run the real
// generated modifications pileup against a modBAM and assert bam_modifications
// recovers a plausible number of high-confidence 5mC ('m') calls, reference-free
maybe('modifications pileup script runs and bam_modifications finds 5mC calls', () => {
  const bam = resolve(
    process.cwd(),
    'test_data/modifications_test/methylation_clip.bam',
  )
  const fragments = alignmentsFragments({
    ...baseParams,
    trackId: 'aln',
    trackName: 'ONT modBAM',
    uri: bam,
    showCoverage: false,
    showPileup: true,
    colorBy: 'modifications',
    modificationThreshold: 0.5,
  })
  const script = assembleRScript(
    { refName: '20', start: 0, end: 12000 },
    fragments,
  )
  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-mods-'))
  writeFileSync(join(dir, 'view.R'), script)
  execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)

  // probe bam_modifications directly over the region
  const helpers = script.split('# Data sources')[0]!
  const probe = `${helpers}
mm <- bam_modifications(${JSON.stringify(bam)}, "20", 0, 12000, 0.5)
cat(nrow(mm), paste(unique(mm$modtype), collapse = ","), "\\n")
`
  writeFileSync(join(dir, 'probe.R'), probe)
  const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
    cwd: dir,
    encoding: 'utf8',
  }).trim()
  const [n, types] = out.split(/\s+/)
  expect(Number(n)).toBeGreaterThan(50)
  expect(types).toBe('m')
}, 90000)

// linkedReads = "normal": the generated chain-layout script must run, and
// link_reads must group a paired BAM's records into chains by read name and
// produce mate-gap connectors (each chain spans its full template, so it uses
// as many or more rows than a flat pileup, not fewer)
maybe('linkReads chain-layout script runs and links mates onto shared rows', () => {
  const bam = resolve(
    process.cwd(),
    'test_data/volvox/volvox-simple-inv-paired.bam',
  )
  const fragments = alignmentsFragments({
    ...baseParams,
    trackId: 'aln',
    trackName: 'Volvox pairs',
    uri: bam,
    showCoverage: false,
    showPileup: true,
    colorBy: 'pairOrientation',
    linkReads: true,
  })
  const script = assembleRScript({ refName: 'ctgA', start: 5000, end: 9000 }, fragments)
  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-link-'))
  writeFileSync(join(dir, 'view.R'), script)
  execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)

  // probe link_reads: records group into fewer chains by read name, every read
  // gets a chain row, and mate-pair gaps yield connector segments
  const helpers = script.split('# Data sources')[0]!
  const probe = `${helpers}
reads <- read_bam(${JSON.stringify(bam)}, "ctgA", 5000, 9000)
linked <- link_reads(reads)
# every record gets exactly one chain row; chains number <= records (grouping)
cat(nrow(reads), length(unique(linked$reads$name)), nrow(linked$links),
    sum(is.na(linked$reads$row)), "\\n")
`
  writeFileSync(join(dir, 'probe.R'), probe)
  const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
    cwd: dir,
    encoding: 'utf8',
  }).trim()
  const [records, chains, links, unrowed] = out.split(/\s+/).map(Number)
  // grouping by read name collapses records into fewer (or equal) chains
  expect(chains!).toBeLessThan(records!)
  // paired mates in the window produce gap connectors (link_reads' whole point)
  expect(links!).toBeGreaterThan(0)
  // every read is assigned a chain row
  expect(unrowed).toBe(0)
}, 90000)

// CRAM: Rsamtools can't read CRAM, so each panel's cram_to_bam() decodes the
// region to a temp BAM with samtools first. Run the real generated script end to
// end, then prove the reference-free MD-tag mismatch walk still finds the known
// ctgA:1693 C-SNP through the CRAM decode (samtools restores MD from the ref).
maybeCram('generated CRAM script decodes via samtools and keeps MD mismatches', () => {
  const cram = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.cram')
  const ref = resolve(process.cwd(), 'test_data/volvox/volvox.fa')
  const fragments = alignmentsFragments({
    ...baseParams,
    trackId: 'aln',
    trackName: 'Volvox CRAM',
    uri: cram,
    isCram: true,
    reference: ref,
    showCoverage: true,
    showPileup: true,
    colorBy: 'normal',
  })
  const script = assembleRScript({ refName: 'ctgA', start: 0, end: 5000 }, fragments)
  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-cram-'))
  writeFileSync(join(dir, 'view.R'), script)
  execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)

  // probe: decode the CRAM region, then run the reference-free MD walk on it
  const helpers = script.split('# Data sources')[0]!
  const probe = `${helpers}
bam <- cram_to_bam(${JSON.stringify(cram)}, "ctgA", 1600, 1800, ${JSON.stringify(ref)})
mm <- bam_mismatches(bam, "ctgA", 1600, 1800)
snp <- aggregate(read_index ~ refpos + base, data = mm, FUN = length)
top <- snp[which.max(snp$read_index), ]
cat(top$refpos, as.character(top$base), top$read_index, "\\n")
`
  writeFileSync(join(dir, 'probe.R'), probe)
  const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
    cwd: dir,
    encoding: 'utf8',
  }).trim()
  const [refpos, altBase, count] = out.split(/\s+/)
  expect(refpos).toBe('1693')
  expect(altBase).toBe('C')
  expect(Number(count)).toBeGreaterThanOrEqual(15)
}, 90000)

// soft/hard clip bars: the generated pileup must run, and bam_clips must recover
// the clips clustered at an SV breakpoint (the diagnostic value of clip display)
maybe('clip pileup script runs and bam_clips finds soft/hard clips', () => {
  const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sv.bam')
  const fragments = alignmentsFragments({
    ...baseParams,
    trackId: 'aln',
    trackName: 'Volvox SV',
    uri: bam,
    showCoverage: false,
    showPileup: true,
    colorBy: 'normal',
  })
  const script = assembleRScript({ refName: 'ctgA', start: 41000, end: 44000 }, fragments)
  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-clip-'))
  writeFileSync(join(dir, 'view.R'), script)
  execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)

  const helpers = script.split('# Data sources')[0]!
  const probe = `${helpers}
clips <- bam_clips(${JSON.stringify(bam)}, "ctgA", 41000, 44000)
cat(nrow(clips), sum(clips$type == "S"), paste(sort(unique(clips$type)), collapse = ""), "\\n")
`
  writeFileSync(join(dir, 'probe.R'), probe)
  const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
    cwd: dir,
    encoding: 'utf8',
  }).trim()
  const [total, soft, types] = out.split(/\s+/)
  // the SV region carries clipped reads, dominated by soft clips
  expect(Number(total)).toBeGreaterThan(10)
  expect(Number(soft)).toBeGreaterThan(0)
  expect(types).toMatch(/S/)
}, 90000)
