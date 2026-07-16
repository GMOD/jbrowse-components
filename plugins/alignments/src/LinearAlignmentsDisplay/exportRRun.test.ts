import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { alignmentsFragments } from './exportRCode.ts'
import {
  classifyInsertSize,
  getInsertSizeStats,
} from '../shared/insertSizeStats.ts'

const baseParams = {
  isCram: false,
  reference: '',
  linkReads: false,
  showLowFreqMismatches: false,
  modificationThreshold: 0.1,
  sortPos: -1,
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
const maybeCram = rWithAlignmentStack() && haveSamtools() ? test : test.skip

maybe(
  'generated alignments R script runs and produces a figure',
  () => {
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
    const script = assembleRScript(
      { refName: 'ctgA', start: 0, end: 5000 },
      fragments,
    )

    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-bam-'))
    const scriptPath = join(dir, 'view.R')
    writeFileSync(scriptPath, script)

    execFileSync('Rscript', [scriptPath], { cwd: dir, stdio: 'pipe' })

    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
  },
  90000,
)

// interbase_indicators reproduces JBrowse's coverage-band breakpoint flags:
// significant only where local depth >= 8 and the interbase events exceed 30% of
// it, typed by the dominant event (insertion, else softclip, else hardclip).
// Synthetic inputs make the expected significant set deterministic.
maybe(
  'interbase_indicators applies the depth/threshold gate and dominant type',
  () => {
    // any coverage fragment emits the interbase_indicators helper def; reuse it
    const [cov] = alignmentsFragments({
      ...baseParams,
      trackId: 'aln',
      trackName: 'x',
      uri: '/dev/null',
      showCoverage: true,
      showPileup: false,
      colorBy: 'normal',
    })
    const script = assembleRScript(
      { refName: 'ctgA', start: 100, end: 110 },
      [cov!],
    )
    const helpers = script.split('# Data sources')[0]!
    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-interbase-'))
    // depth 10 everywhere except pos 109 (5, below the min-depth gate). Events:
    // 105 = 4 ins (sig, I); 106 = 3 ins + 4 soft (sig, soft dominates → S);
    // 107 = 5 soft (sig, S); 103 = 2 ins (< 30% of 10, dropped); 109 = 4 hard
    // (depth 5 < 8, dropped)
    const probe = `${helpers}
cov <- data.frame(pos = 100:110, depth = rep(10, 11))
cov$depth[cov$pos == 109] <- 5
indels <- data.frame(
  refpos = c(105L, 105L, 105L, 105L, 103L, 103L, 106L, 106L, 106L),
  length = 1L, type = "I", stringsAsFactors = FALSE)
clips <- data.frame(
  pos = c(rep(107L, 5), rep(106L, 4), rep(109L, 4)),
  type = c(rep("S", 5), rep("S", 4), rep("H", 4)), stringsAsFactors = FALSE)
ind <- interbase_indicators(indels, clips, cov)
o <- order(ind$pos)
cat(paste(ind$pos[o], ind$type[o], sep = ":"), "\\n")
`
    writeFileSync(join(dir, 'probe.R'), probe)
    const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    expect(out).toBe('105:I 106:S 107:S')
  },
  90000,
)

// Cross-implementation equivalence: the R insertSize branch of read_fill_colors
// must classify every read exactly as the JS getInsertSizeStats/classifyInsertSize
// does over the same data — the robust median±3·1.4826·MAD spread from primary
// proper-pair |TLEN| values (not mean±3·sd, which the right-skewed SV tail would
// inflate so no read is ever flagged "short"). Same reads drive both sides.
maybe(
  'R insertSize coloring matches JS getInsertSizeStats read-for-read',
  () => {
    // right-skewed |TLEN|: a tight bulk near 300 plus a long SV tail
    const reads: { isize: number; flag: number }[] = []
    for (let i = 0; i < 200; i++) {
      reads.push({ isize: 250 + ((i * 7) % 100), flag: 0x2 })
    }
    for (const s of [3000, 3500, 4000, 4500, 5000]) {
      reads.push({ isize: s, flag: 0x2 })
    }
    // discriminating probes + reads excluded from the stat set
    reads.push({ isize: 320, flag: 0x2 }) // bulk → normal
    reads.push({ isize: 100, flag: 0x2 }) // short under MAD, normal under mean±sd
    reads.push({ isize: 6000, flag: 0x2 }) // long
    reads.push({ isize: 0, flag: 0x2 }) // tlen 0 → always normal
    reads.push({ isize: 80, flag: 0x0 }) // not proper-pair: excluded from stats
    reads.push({ isize: 9000, flag: 0x2 | 0x800 }) // supplementary: excluded

    // JS side: stats over exactly the primary proper-pair, |TLEN|>0 reads
    const statSet = reads
      .filter(r => !!(r.flag & 0x2) && !(r.flag & 0x100) && !(r.flag & 0x800))
      .map(r => r.isize)
      .filter(s => s > 0)
    const stats = getInsertSizeStats(statSet)
    const expected = reads.map(r => classifyInsertSize(r.isize, stats))
    // the two estimators must disagree on the isize=100 read, else the test is toothless
    expect(expected[reads.findIndex(r => r.isize === 100)]).toBe('short')

    // R side: run read_fill_colors(reads, "insertSize") over the identical reads
    const [pileup] = alignmentsFragments({
      ...baseParams,
      trackId: 'aln',
      trackName: 'x',
      uri: '/dev/null',
      showCoverage: false,
      showPileup: true,
      colorBy: 'insertSize',
    })
    const helpers = assembleRScript(
      { refName: 'ctgA', start: 0, end: 1 },
      [pileup!],
    ).split('# Data sources')[0]!
    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-isize-'))
    const probe = `${helpers}
reads <- data.frame(isize = c(${reads.map(r => r.isize).join(', ')}),
                    flag = c(${reads.map(r => r.flag).join(', ')}))
col <- read_fill_colors(reads, "insertSize")
cls <- ifelse(col == "#ff0000", "long", ifelse(col == "#ffc0cb", "short", "normal"))
cat(cls, "\\n")
`
    writeFileSync(join(dir, 'probe.R'), probe)
    const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    expect(out.split(/\s+/)).toEqual(expected)
  },
  90000,
)

// exercise every color-by scheme's read_fill_colors branch (incl. the MAPQ hue
// ramp + insert-size stats) through the real generated script
maybe(
  'generated script runs for each color-by scheme',
  () => {
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
  },
  120000,
)

// the MD-tag mismatch walk is the accuracy-critical part; run it directly and
// assert it finds the real C-SNP at ctgA:1693 (~20 reads) that pileup() confirms
maybe(
  'bam_mismatches finds the known SNP column, reference-free',
  () => {
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
    ]).split('# Data sources')[0]!
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
  },
  90000,
)

// the MM/ML modification parse is the other accuracy-critical walk; run the real
// generated modifications pileup against a modBAM and assert bam_modifications
// recovers a plausible number of high-confidence 5mC ('m') calls, reference-free
maybe(
  'modifications pileup script runs and bam_modifications finds 5mC calls',
  () => {
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
  },
  90000,
)

// perBaseQuality: the generated pileup must run, and bam_base_quality must map a
// Phred score onto every aligned base (the signal the color-by paints), with
// quality_colors turning each into a valid hex on JBrowse's ramp
maybe(
  'perBaseQuality pileup runs and bam_base_quality scores every base',
  () => {
    const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
    const fragments = alignmentsFragments({
      ...baseParams,
      trackId: 'aln',
      trackName: 'Volvox reads',
      uri: bam,
      showCoverage: false,
      showPileup: true,
      colorBy: 'perBaseQuality',
    })
    const script = assembleRScript(
      { refName: 'ctgA', start: 3000, end: 3200 },
      fragments,
    )
    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-baseq-'))
    writeFileSync(join(dir, 'view.R'), script)
    execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)

    const helpers = script.split('# Data sources')[0]!
    const probe = `${helpers}
bq <- bam_base_quality(${JSON.stringify(bam)}, "ctgA", 3000, 3200)
cols <- quality_colors(bq$score)
cat(nrow(bq), max(bq$score), sum(!grepl("^#[0-9A-Fa-f]{6}$", cols)), "\\n")
`
    writeFileSync(join(dir, 'probe.R'), probe)
    const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    const [count, maxScore, badColors] = out.split(/\s+/).map(Number)
    // many aligned bases scored, all as valid Phred integers, every color a hex
    expect(count!).toBeGreaterThan(100)
    expect(maxScore!).toBeGreaterThan(0)
    expect(badColors).toBe(0)
  },
  90000,
)

// linkedReads = "normal": the generated chain-layout script must run, and
// link_reads must group a paired BAM's records into chains by read name and
// produce mate-gap connectors (each chain spans its full template, so it uses
// as many or more rows than a flat pileup, not fewer)
maybe(
  'linkReads chain-layout script runs and links mates onto shared rows',
  () => {
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
    const script = assembleRScript(
      { refName: 'ctgA', start: 5000, end: 9000 },
      fragments,
    )
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
  },
  90000,
)

// sortedBy "base": the generated sort-pileup script must run, and
// sorted_pileup_layout must order the reads covering the center column by their
// base there — the alt-allele reads (the known C-SNP at ctgA:1693) all take
// lower rows than the reference-matching reads, JBrowse's "Sort by base" grouping
maybe(
  'base-sort pileup script runs and groups alt reads above ref reads',
  () => {
    const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
    const fragments = alignmentsFragments({
      ...baseParams,
      trackId: 'aln',
      trackName: 'Volvox reads',
      uri: bam,
      showCoverage: false,
      showPileup: true,
      colorBy: 'normal',
      sortType: 'base',
      sortPos: 1693,
    })
    const script = assembleRScript(
      { refName: 'ctgA', start: 1600, end: 1800 },
      fragments,
    )
    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-sortbase-'))
    writeFileSync(join(dir, 'view.R'), script)
    execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)

    // probe: the reads covering 1693 must be sorted so every C-allele read sits
    // above (lower row) every reference-matching read
    const helpers = script.split('# Data sources')[0]!
    const probe = `${helpers}
reads <- read_bam(${JSON.stringify(bam)}, "ctgA", 1600, 1800)
mm <- bam_mismatches(${JSON.stringify(bam)}, "ctgA", 1600, 1800)
laid <- sorted_pileup_layout(reads, 1693, "base", mm)
ov <- which(laid$start <= 1693 & laid$end > 1693)
# alt = reads carrying any mismatch base at the SNP column; ref = reads matching
# the reference there (no mismatch entry) - the base sort places all alt above ref
alt <- intersect(mm$read_index[mm$refpos == 1693], ov)
ref <- setdiff(ov, alt)
cat(length(alt), length(ref), max(laid$row[alt]), min(laid$row[ref]), "\\n")
`
    writeFileSync(join(dir, 'probe.R'), probe)
    const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    const [nAlt, nRef, maxAltRow, minRefRow] = out.split(/\s+/).map(Number)
    // both allele groups are present at the SNP column (the C-SNP dominates, so
    // only a few reads still match the reference there)
    expect(nAlt!).toBeGreaterThan(3)
    expect(nRef!).toBeGreaterThan(0)
    // and every alt read is placed strictly above every ref read (the sort)
    expect(maxAltRow!).toBeLessThan(minRefRow!)
  },
  90000,
)

// base sort deletion fidelity: JBrowse ranks a read carrying a *deletion* over
// sort_pos as '*' (ASCII 42), ahead of every ACGT mismatch base and ahead of the
// reference-matching reads. sorted_pileup_layout must reproduce that ordering
// from the CIGAR indels passed alongside the mismatches. Synthetic reads (four
// reads all covering the center column: a deletion, a 'T' mismatch, an 'A'
// mismatch, and a reference match) make the expected order deterministic.
maybe(
  'base sort places a deletion over sort_pos ahead of ACGT and reference reads',
  () => {
    // any base-sort fragment emits the sorted_pileup_layout helper def; reuse it
    const fragments = alignmentsFragments({
      ...baseParams,
      trackId: 'aln',
      trackName: 'x',
      uri: '/dev/null',
      showCoverage: false,
      showPileup: true,
      colorBy: 'normal',
      sortType: 'base',
      sortPos: 100,
    })
    const script = assembleRScript(
      { refName: 'ctgA', start: 0, end: 200 },
      fragments,
    )
    const helpers = script.split('# Data sources')[0]!
    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-delsort-'))
    // read 1 reference-matching (no mm, no indel), 2 = 'T' (84), 3 = 'A' (65),
    // 4 = deletion over 100 (should rank '*' = 42, ahead of all)
    const probe = `${helpers}
reads <- data.frame(name = paste0("r", 1:4), start = rep(50L, 4),
                    end = rep(150L, 4), strand = "+", stringsAsFactors = FALSE)
mm <- data.frame(read_index = c(2L, 3L), refpos = c(100L, 100L),
                 base = c("T", "A"), stringsAsFactors = FALSE)
indels <- data.frame(read_index = 4L, refpos = 98L, length = 5L, type = "D",
                     stringsAsFactors = FALSE)
laid <- sorted_pileup_layout(reads, 100, "base", mm, indels)
cat(laid$row[4], laid$row[3], laid$row[2], laid$row[1], "\\n")
`
    writeFileSync(join(dir, 'probe.R'), probe)
    const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    const [delRow, aRow, tRow, refRow] = out.split(/\s+/).map(Number)
    // deletion above 'A' above 'T' above the reference-matching read
    expect(delRow!).toBeLessThan(aRow!)
    expect(aRow!).toBeLessThan(tRow!)
    expect(tRow!).toBeLessThan(refRow!)
  },
  90000,
)

// sortedBy "position"/"strand": the localized sort at the center line orders the
// reads covering it (position = ascending start; strand = forward first) and the
// generated figure runs
maybe(
  'position/strand-sort pileup scripts run and order the center reads',
  () => {
    const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
    for (const sortType of ['position', 'strand'] as const) {
      const fragments = alignmentsFragments({
        ...baseParams,
        trackId: 'aln',
        trackName: 'Volvox reads',
        uri: bam,
        showCoverage: false,
        showPileup: true,
        colorBy: 'normal',
        sortType,
        sortPos: 3100,
      })
      const script = assembleRScript(
        { refName: 'ctgA', start: 3000, end: 3200 },
        fragments,
      )
      const dir = mkdtempSync(join(tmpdir(), `jb-rexport-sort-${sortType}-`))
      writeFileSync(join(dir, 'view.R'), script)
      execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
      expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
    }

    // probe position sort: among the reads covering the column, row order follows
    // ascending genomic start (each overlapping read gets its own row)
    const helpers = assembleRScript({ refName: 'ctgA', start: 0, end: 1 }, [
      alignmentsFragments({
        ...baseParams,
        trackId: 'aln',
        trackName: 'Volvox reads',
        uri: bam,
        showCoverage: false,
        showPileup: true,
        colorBy: 'normal',
        sortType: 'position',
        sortPos: 3100,
      })[0]!,
    ]).split('# Data sources')[0]!
    const probe = `${helpers}
reads <- read_bam(${JSON.stringify(bam)}, "ctgA", 3000, 3200)
laid <- sorted_pileup_layout(reads, 3100, "position")
ov <- which(laid$start <= 3100 & laid$end > 3100)
o <- ov[order(laid$row[ov])]
cat(length(ov), as.integer(!is.unsorted(laid$start[o])), "\\n")
`
    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-sortpos-'))
    writeFileSync(join(dir, 'probe.R'), probe)
    const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    const [nOverlap, startsAscending] = out.split(/\s+/).map(Number)
    expect(nOverlap!).toBeGreaterThan(1)
    // rows follow ascending genomic start for the reads over the sort column
    expect(startsAscending).toBe(1)
  },
  90000,
)

// filterBy: the generated pileup runs read_filter, which must drop reads by SAM
// flag exactly like JBrowse (a filtered read gets an NA row and goes undrawn) —
// here excluding the reverse-strand bit (0x10) keeps only the forward reads
maybe(
  'filter-by-flag pileup runs and read_filter drops reads by SAM flag',
  () => {
    const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
    const fragments = alignmentsFragments({
      ...baseParams,
      trackId: 'aln',
      trackName: 'Volvox reads',
      uri: bam,
      showCoverage: false,
      showPileup: true,
      colorBy: 'strand',
      filterFlagExclude: 16,
    })
    const script = assembleRScript(
      { refName: 'ctgA', start: 0, end: 5000 },
      fragments,
    )
    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-filterflag-'))
    writeFileSync(join(dir, 'view.R'), script)
    execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)

    const helpers = script.split('# Data sources')[0]!
    const probe = `${helpers}
reads <- read_bam(${JSON.stringify(bam)}, "ctgA", 0, 5000)
kept <- read_filter(reads, ${JSON.stringify(bam)}, "ctgA", 0, 5000, 0, 16)
# excluding 0x10 keeps exactly the forward-strand reads, none dropped otherwise
cat(nrow(reads), sum(kept$keep), sum(reads$strand == "+"), "\\n")
`
    writeFileSync(join(dir, 'probe.R'), probe)
    const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    const [total, kept, forward] = out.split(/\s+/).map(Number)
    expect(total!).toBeGreaterThan(0)
    // some reads are filtered (there are reverse reads to drop)
    expect(kept!).toBeLessThan(total!)
    // and the kept set is exactly the forward-strand reads
    expect(kept).toBe(forward)
  },
  90000,
)

// filterBy tag filter: volvox-rg.bam carries RG:Z:4 / RG:Z:5 read groups (200
// each). read_filter must keep only the reads whose tag matches, honor "*"
// (has-the-tag), and drop everything for an absent value — JBrowse's tag filter.
maybe(
  'filter-by-tag pileup runs and read_filter matches the RG tag',
  () => {
    const bam = resolve(process.cwd(), 'test_data/volvox/volvox-rg.bam')
    const fragments = alignmentsFragments({
      ...baseParams,
      trackId: 'aln',
      trackName: 'Volvox RG',
      uri: bam,
      showCoverage: false,
      showPileup: true,
      colorBy: 'normal',
      filterTagFilters: [{ tag: 'RG', value: '4' }],
    })
    const script = assembleRScript(
      { refName: 'ctgA', start: 0, end: 5000 },
      fragments,
    )
    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-filtertag-'))
    writeFileSync(join(dir, 'view.R'), script)
    execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)

    const helpers = script.split('# Data sources')[0]!
    const probe = `${helpers}
b <- ${JSON.stringify(bam)}
reads <- read_bam(b, "ctgA", 0, 5000)
f4 <- read_filter(reads, b, "ctgA", 0, 5000, 0, 0, NULL, list(list(tag = "RG", value = "4")))
fhas <- read_filter(reads, b, "ctgA", 0, 5000, 0, 0, NULL, list(list(tag = "RG", value = "*")))
fnone <- read_filter(reads, b, "ctgA", 0, 5000, 0, 0, NULL, list(list(tag = "RG", value = "nope")))
cat(nrow(reads), sum(f4$keep), sum(fhas$keep), sum(fnone$keep), "\\n")
`
    writeFileSync(join(dir, 'probe.R'), probe)
    const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    const [total, rg4, hasRg, none] = out.split(/\s+/).map(Number)
    expect(total).toBe(400)
    expect(rg4).toBe(200) // exactly the RG:Z:4 reads
    expect(hasRg).toBe(400) // every read has an RG tag
    expect(none).toBe(0) // no read matches a bogus value
  },
  90000,
)

// CRAM: Rsamtools can't read CRAM, so each panel's cram_to_bam() decodes the
// region to a temp BAM with samtools first. Run the real generated script end to
// end, then prove the reference-free MD-tag mismatch walk still finds the known
// ctgA:1693 C-SNP through the CRAM decode (samtools restores MD from the ref).
maybeCram(
  'generated CRAM script decodes via samtools and keeps MD mismatches',
  () => {
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
    const script = assembleRScript(
      { refName: 'ctgA', start: 0, end: 5000 },
      fragments,
    )
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
  },
  90000,
)

// CIGAR indels: the generated pileup must run, and bam_indels must recover the
// deletion cluster (multiple reads sharing a 1D op at the same reference column,
// the deletion signal) that read_bam's aligned span otherwise swallows
maybe(
  'indel pileup script runs and bam_indels finds the deletion column',
  () => {
    const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
    const fragments = alignmentsFragments({
      ...baseParams,
      trackId: 'aln',
      trackName: 'Volvox reads',
      uri: bam,
      showCoverage: false,
      showPileup: true,
      colorBy: 'normal',
    })
    const script = assembleRScript(
      { refName: 'ctgA', start: 3700, end: 3900 },
      fragments,
    )
    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-indel-'))
    writeFileSync(join(dir, 'view.R'), script)
    execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)

    const helpers = script.split('# Data sources')[0]!
    const probe = `${helpers}
d <- bam_indels(${JSON.stringify(bam)}, "ctgA", 3700, 3900)
dd <- d[d$type == "D", ]
cat(nrow(dd), as.integer(names(which.max(table(dd$refpos)))), "\\n")
`
    writeFileSync(join(dir, 'probe.R'), probe)
    const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    const [count, modalRefpos] = out.split(/\s+/).map(Number)
    // several reads carry the deletion, all at the same 0-based reference column
    expect(count!).toBeGreaterThan(5)
    expect(modalRefpos).toBe(3858)
  },
  90000,
)

// spliced (RNA-seq) reads: bam_indels must recover the shared intron (N op),
// which the pileup erases from the read body + draws a thin teal connector over
maybe(
  'bam_indels finds the spliced-read intron (N op)',
  () => {
    const bam = resolve(process.cwd(), 'test_data/volvox/spliced.bam')
    const [fragment] = alignmentsFragments({
      ...baseParams,
      trackId: 'aln',
      trackName: 'Volvox spliced',
      uri: bam,
      showCoverage: false,
      showPileup: true,
      colorBy: 'normal',
    })
    const helpers = assembleRScript({ refName: 'ctgA', start: 0, end: 1 }, [
      fragment!,
    ]).split('# Data sources')[0]!
    const probe = `${helpers}
s <- bam_indels(${JSON.stringify(bam)}, "ctgA", 400, 1000)
ss <- s[s$type == "N", ]
cat(nrow(ss), as.integer(names(which.max(table(ss$length)))), "\\n")
`
    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-skip-'))
    writeFileSync(join(dir, 'probe.R'), probe)
    const out = execFileSync('Rscript', [join(dir, 'probe.R')], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    const [count, modalLen] = out.split(/\s+/).map(Number)
    expect(count!).toBeGreaterThan(3)
    expect(modalLen).toBe(347)
  },
  90000,
)

// soft/hard clip bars: the generated pileup must run, and bam_clips must recover
// the clips clustered at an SV breakpoint (the diagnostic value of clip display)
maybe(
  'clip pileup script runs and bam_clips finds soft/hard clips',
  () => {
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
    const script = assembleRScript(
      { refName: 'ctgA', start: 41000, end: 44000 },
      fragments,
    )
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
  },
  90000,
)
