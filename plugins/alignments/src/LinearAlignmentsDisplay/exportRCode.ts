import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import {
  firstUri,
  getTrackRMeta,
  rStr,
  safeVarName,
} from '@jbrowse/plugin-linear-genome-view'

import { DEFAULT_MODIFICATION_THRESHOLD } from '../shared/types.ts'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  type?: string
  bamLocation?: { uri?: string }
  cramLocation?: { uri?: string }
  uri?: string
}

interface SequenceAdapterConf {
  fastaLocation?: { uri?: string }
  uri?: string
}

/**
 * The reference FASTA uri from the display's assembly sequence adapter, so a
 * CRAM track can be decoded (cram_to_bam passes it to `samtools view -T`). The
 * CRAM adapter's own sequenceAdapter is injected at runtime and isn't in its
 * static config, so resolve it via the assembly instead. Empty string when it
 * can't be found (or the sequence isn't a plain/bgzipped FASTA) — cram_to_bam
 * then falls back to the CRAM's UR header / REF_PATH.
 */
function referenceFastaUri(self: LinearAlignmentsDisplayModel): string {
  const view = getContainingView(self) as { assemblyNames?: string[] }
  const assemblyName = view.assemblyNames?.[0]
  const assembly = assemblyName
    ? getSession(self).assemblyManager.get(assemblyName)
    : undefined
  const seq = assembly
    ? (getConf(assembly, ['sequence', 'adapter']) as SequenceAdapterConf)
    : undefined
  return seq?.fastaLocation?.uri ?? seq?.uri ?? ''
}

export interface AlignmentsRParams {
  trackId: string
  trackName: string
  uri: string
  showCoverage: boolean
  showPileup: boolean
  // resolved color-by scheme (self.colorBy.type): normal/strand/mappingQuality/
  // insertSize/pairOrientation/modifications are reproduced; other schemes fall
  // back to grey
  colorBy: string
  // JBrowse's "show low frequency mismatches": when false (the default) the
  // pileup fades mismatch ticks below snp_freq_threshold(depth) once zoomed out
  // past 1 bp/px; when true every tick stays opaque. The coverage panel always
  // shows every mismatch fraction regardless (matching computeSNPCoverage).
  showLowFreqMismatches: boolean
  // view zoom (bases per pixel) at export; gates the pileup low-frequency fade
  // (JBrowse only fades past 1 bp/px, the sub-pixel regime). 1 = no fade.
  bpPerPx: number
  // minimum MM/ML modification-call probability drawn in the modifications
  // scheme (0..1); JBrowse's default is 0.1 (a 10% threshold slider)
  modificationThreshold: number
  // JBrowse linkedReads === 'normal': group mates + supplementary segments by
  // read name onto one row with connector lines (link_reads) instead of the flat
  // per-read pileup (pileup_layout)
  linkReads: boolean
  // CRAM track: Rsamtools can't read CRAM, so each panel decodes its region to a
  // temporary BAM via cram_to_bam() before the bam_* helpers run
  isCram: boolean
  // reference FASTA uri for CRAM decoding (from the assembly's sequence adapter);
  // empty falls back to the CRAM's own UR header / REF_PATH inside cram_to_bam
  reference: string
  // JBrowse's localized "Sort by..." at the center line, reproduced by
  // sorted_pileup_layout: orders the reads overlapping sortPos by read start /
  // strand / base call / interbase length / sort-tag value. undefined = plain
  // pileup_layout (no sort, or an unrecognized type)
  sortType?: RSortType
  // the BAM tag the 'tag' sort reads (self.sortedBy.tag), e.g. HP for haplotype
  sortTag?: string
  // genomic column the sort anchors on (the center line at export); -1 (default)
  // when no center line, which leaves every read in genomic order
  sortPos?: number
  // JBrowse "Filter by" (read_filter): SAM flag include/exclude bitmasks, an
  // optional exact read-name match, and AND-ed tag filters (value "*" = has tag).
  // Applied to the pileup; a filtered read gets an NA row and goes undrawn.
  // Flags default to JBrowse's defaultFilterFlags (0 include / 1540 exclude).
  filterFlagInclude?: number
  filterFlagExclude?: number
  filterReadName?: string
  filterTagFilters?: { tag: string; value?: string }[]
}

// Emit the tag-filter list read_filter consumes: list() when empty, else a list
// of list(tag=, value=) (a missing value defaults to "*" = "read has the tag").
function emitTagFilters(filters: { tag: string; value?: string }[]) {
  return filters.length === 0
    ? 'list()'
    : `list(${filters
        .map(f => `list(tag = ${rStr(f.tag)}, value = ${rStr(f.value ?? '*')})`)
        .join(', ')})`
}

// Map self.sortedBy.type to the sort the R sorted_pileup_layout reproduces.
// basePair -> base; every other JBrowse sort type passes through under its own
// name. An unknown type -> undefined, falling back to plain layout rather than
// silently sorting by something else.
type RSortType = (typeof SORT_TYPES)[number]
const SORT_TYPES = [
  'position',
  'strand',
  'base',
  'insertion',
  'softclip',
  'hardclip',
  'tag',
] as const

function resolveSortType(type: string | undefined): RSortType | undefined {
  const name = type === 'basePair' ? 'base' : type
  return SORT_TYPES.find(t => t === name)
}

// The overlay frames each sort keys off, appended to the sorted_pileup_layout
// call (signature: reads, sort_pos, sort_type, mm, indels, clips). position /
// strand read the reads frame itself; tag reads the reads$sort_tag column the
// loop attaches.
const SORT_ARGS: Record<RSortType, string> = {
  position: '',
  strand: '',
  base: ', mm, indels',
  insertion: ', NULL, indels',
  softclip: ', NULL, NULL, clips',
  hardclip: ', NULL, NULL, clips',
  tag: '',
}

// The comment above each sort's call in the emitted script — the reader is meant
// to understand the ordering without opening the helper.
const SORT_NOTES: Record<RSortType, string> = {
  position: 'sort reads by start at the center-line column',
  strand: 'sort reads by strand at the center-line column (forward first)',
  base: `sort reads by their base at the center-line column (a deletion sorts as '*',
  # ahead of the ACGT bases, like JBrowse)`,
  insertion: `sort reads by the length of their insertion at the center-line column,
  # longest first (reads without one keep genomic order below)`,
  softclip: `sort reads by the length of their soft clip at the center-line column,
  # longest first (reads without one keep genomic order below)`,
  hardclip: `sort reads by the length of their hard clip at the center-line column,
  # longest first (reads without one keep genomic order below)`,
  tag: `sort reads by their sort-tag value at the center-line column, descending
  # (numerically when every value is a number, else by string collation)`,
}

// JBrowse exposes ~a dozen color-by schemes; map each to the closest scheme the
// R script reproduces. Most bake literal read-body colors (see read_fill_colors);
// modifications/methylation keep grey bodies and overlay MM/ML mod ticks (see
// bam_modifications); perBaseQuality keeps grey bodies and overlays a per-base
// Phred-colored rect (see bam_base_quality). Anything else resolves to normal
// grey rather than silently mislabeling.
function resolveColorScheme(colorBy: string) {
  const map: Record<string, string> = {
    strand: 'strand',
    firstOfPairStrand: 'strand',
    stranded: 'strand',
    mappingQuality: 'mappingQuality',
    insertSize: 'insertSize',
    insertSizeGradient: 'insertSize',
    insertSizeAndOrientation: 'insertSize',
    pairOrientation: 'pairOrientation',
    modifications: 'modifications',
    methylation: 'modifications',
    perBaseQuality: 'perBaseQuality',
  }
  return map[colorBy] ?? 'normal'
}

/**
 * Pure builder for the R panels of an alignments track. Emits up to two stacked
 * panels using plain ggplot2 + inline helpers (no bespoke package): SNP coverage
 * (grey `bam_coverage` total with per-base mismatch counts stacked on top, above
 * a depth-dependent frequency threshold like JBrowse) and a color-by pileup
 * (`read_fill_colors`: normal/strand/mappingQuality/insertSize/pairOrientation) with per-base
 * mismatch ticks — both derived from the MD tag by `bam_mismatches()`
 * (reference-free, the same signal JBrowse's canvas renderer shows). Row layout
 * is the visible, editable `pileup_layout()` helper.
 *
 * Each region in the view is read separately and placed on one cumulative-bp
 * x-axis (JBrowse's multi-region view). Per-read overlays (mismatches, indels,
 * clips, mods, base quality) join to their pileup row by `read_index`, so each
 * region's index is renumbered to its position in the combined `reads` frame
 * before concatenation; layout then runs over the combined reads, giving
 * cross-region-consistent rows and — in chain mode (link_reads) — connectors
 * that span the gap between a mate/segment in one region and its partner in
 * another. The shared axis + inter-region dividers come from plot_regions().
 */
export function alignmentsFragments(p: AlignmentsRParams): RTrackFragment[] {
  const scheme = resolveColorScheme(p.colorBy)
  const pathVar = safeVarName(p.trackId)
  const refVar = `${pathVar}_ref`
  const setup = p.isCram
    ? `${pathVar} <- ${rStr(p.uri)}\n${refVar} <- ${p.reference ? rStr(p.reference) : 'NULL'}`
    : `${pathVar} <- ${rStr(p.uri)}`
  // Rsamtools can't read CRAM, so a CRAM track decodes each region to a
  // temporary BAM (cram_to_bam) inside the per-region loop; a BAM reads directly.
  // The file path is aliased to a dot-name once before the loop (`.bampath`) so
  // the per-region `reads`/`bam`/... locals can't shadow it even if the track id
  // sanitizes to one of those names (safeVarName never emits a leading dot).
  const pathAlias = p.isCram
    ? `  .bampath <- ${pathVar}; .refpath <- ${refVar}`
    : `  .bampath <- ${pathVar}`
  const bamAssign = p.isCram
    ? `# Rsamtools can't read CRAM: decode this region to a temporary BAM first
    bam <- cram_to_bam(.bampath, chrom, start, end, .refpath)`
    : `bam <- .bampath`
  const cramHelpers = p.isCram ? ['cram_to_bam'] : []
  const packages = ['Rsamtools', 'GenomicAlignments', 'ggplot2']
  const fragments: RTrackFragment[] = []

  // JBrowse applies "Filter by" in the *adapter*, so the filtered read stream
  // feeds every consumer — the pileup and the SNP coverage alike. Both panels
  // therefore emit the same filter constants and read through read_filter.
  const filterConsts = `  # JBrowse "Filter by": SAM flags + optional read-name / tag filters (edit freely)
  flag_include <- ${p.filterFlagInclude ?? 0}
  flag_exclude <- ${p.filterFlagExclude ?? 1540}
  read_name <- ${p.filterReadName ? rStr(p.filterReadName) : 'NULL'}
  tag_filters <- ${emitTagFilters(p.filterTagFilters ?? [])}`
  const readFilteredReads = `reads <- read_filter(read_bam(bam, chrom, start, end), bam, chrom, start, end,
      flag_include, flag_exclude, read_name, tag_filters)`

  if (p.showCoverage) {
    fragments.push({
      trackId: p.trackId,
      trackName: p.trackName,
      packages,
      helpers: [
        ...cramHelpers,
        'read_bam',
        'read_filter',
        'keep_rows',
        'bam_coverage',
        'bam_mismatches',
        'base_colors',
        'bam_indels',
        'bam_clips',
        'interbase_indicators',
        'gap_colors',
        'clip_colors',
      ],
      setup,
      plotVariable: `p_${pathVar}_coverage`,
      heightWeight: 1,
      // read every region's coverage / SNP counts / interbase indicators, shift
      // each onto the cumulative axis, then draw one continuous SNP-coverage panel
      plotExpr: `{
${pathAlias}
${filterConsts}
  parts <- list()
  for (ri in seq_len(nrow(regions))) {
    chrom <- regions$chrom[ri]; start <- regions$start[ri]; end <- regions$end[ri]
    shift <- regions$offset[ri] - regions$start[ri]
    ${bamAssign}
    # count only reads that pass "Filter by", like JBrowse's SNP coverage: it
    # reads the adapter's filtered stream, so a filtered-out read contributes to
    # neither the grey depth nor the colored mismatch counts. keep is in
    # readGAlignments order, so it subsets each overlay by its read_index.
    ${readFilteredReads}
    keep <- reads$keep
    cov0 <- bam_coverage(bam, chrom, start, end, keep)
    ind <- interbase_indicators(keep_rows(bam_indels(bam, chrom, start, end), keep),
                                keep_rows(bam_clips(bam, chrom, start, end), keep), cov0)
    mm <- keep_rows(bam_mismatches(bam, chrom, start, end), keep)
    snp <- NULL
    if (!is.null(mm) && nrow(mm)) {
      mm <- mm[mm$refpos >= start & mm$refpos < end, , drop = FALSE]
      if (nrow(mm)) {
        # per-base mismatch counts (colored) stacked over the grey total = SNP
        # coverage, over the filtered reads only. JBrowse's coverage panel shows
        # every mismatch fraction; the low-frequency fade applies to the pileup
        # ticks, not here.
        snp <- aggregate(read_index ~ refpos + base, data = mm, FUN = length)
        names(snp)[names(snp) == "read_index"] <- "count"
        snp$refpos <- snp$refpos + shift; snp$.region <- ri
      }
    }
    cov0$pos <- cov0$pos + shift; cov0$.region <- ri
    if (nrow(ind)) { ind$pos <- ind$pos + shift; ind$.region <- ri } else ind <- NULL
    parts[[ri]] <- list(cov = cov0, snp = snp, ind = ind)
  }
  cov <- do.call(rbind, lapply(parts, \`[[\`, "cov"))
  snp <- do.call(rbind, Filter(Negate(is.null), lapply(parts, \`[[\`, "snp")))
  ind <- do.call(rbind, Filter(Negate(is.null), lapply(parts, \`[[\`, "ind")))
  p <- ggplot() +
    geom_area(data = cov, aes(pos, depth, group = .region), fill = "#888888") +
    scale_fill_identity() +
    labs(title = ${rStr(`${p.trackName} coverage`)}, x = NULL, y = "Depth") +
    theme_minimal()
  if (!is.null(snp) && nrow(snp)) {
    snp$fill <- base_colors[toupper(snp$base)]
    p <- p + geom_col(data = snp, aes(refpos + 0.5, count, fill = fill), width = 1)
  }
  # interbase indicators: a marker above the coverage where insertions / soft- or
  # hard-clips pile up past 30% of local depth (JBrowse's breakpoint flags),
  # colored by the dominant event (insertion purple / softclip blue / hardclip red)
  if (!is.null(ind) && nrow(ind)) {
    ind$fill <- c(I = gap_colors[["I"]], S = clip_colors[["S"]], H = clip_colors[["H"]])[ind$type]
    p <- p + geom_point(data = ind, aes(pos + 0.5, max(cov$depth, 1) * 1.06, fill = fill),
      shape = 25, size = 2, color = "black", stroke = 0.2)
  }
  p
}`,
    })
  }

  if (p.showPileup) {
    // modifications/methylation keeps grey read bodies and overlays MM/ML mod
    // ticks (bam_modifications); perBaseQuality keeps grey bodies and overlays a
    // per-base Phred-colored rect (bam_base_quality); every other scheme bakes
    // read-body colors and overlays MD-tag mismatch ticks (bam_mismatches).
    const isMods = scheme === 'modifications'
    const isQual = scheme === 'perBaseQuality'
    const bodyScheme = isMods || isQual ? 'normal' : scheme
    const sortType = p.linkReads ? undefined : p.sortType
    // mismatch base is needed by the mismatch scheme and by the base sort; the
    // coverage depth is needed by the mismatch overlay's low-frequency fade
    const needsMm = (!isMods && !isQual) || sortType === 'base'
    const needsCov = !isMods && !isQual

    // per-region reads of the overlay frames, gathered inside the loop
    const loopReads = [
      needsMm ? `    mm <- bam_mismatches(bam, chrom, start, end)` : '',
      needsCov
        ? // the fade's denominator is the depth of the reads actually drawn, so
          // it reads the same filtered coverage the coverage panel does
          `    cov0 <- bam_coverage(bam, chrom, start, end, reads$keep)
    cov0$pos <- cov0$pos + shift; cov0$.region <- ri`
        : '',
      isMods
        ? `    mods <- bam_modifications(bam, chrom, start, end, min_prob)`
        : '',
      isQual ? `    bq <- bam_base_quality(bam, chrom, start, end)` : '',
    ]
      .filter(Boolean)
      .join('\n')
    // entries stored in the per-region parts list (reg() clips to the region,
    // shifts onto the cumulative axis and renumbers read_index into the combined
    // reads frame; cov carries no read_index so it is shifted directly above)
    const loopParts = [
      needsMm ? `mm = reg(mm, "refpos")` : '',
      needsCov ? `cov = cov0` : '',
      isMods ? `mods = reg(mods, "refpos")` : '',
      isQual ? `bq = reg(bq, "refpos")` : '',
    ].filter(Boolean)
    const combine = [
      needsMm
        ? `  mm <- do.call(rbind, Filter(Negate(is.null), lapply(parts, \`[[\`, "mm")))`
        : '',
      needsCov ? `  cov <- do.call(rbind, lapply(parts, \`[[\`, "cov"))` : '',
      isMods
        ? `  mods <- do.call(rbind, Filter(Negate(is.null), lapply(parts, \`[[\`, "mods")))`
        : '',
      isQual
        ? `  bq <- do.call(rbind, Filter(Negate(is.null), lapply(parts, \`[[\`, "bq")))`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    // constants set once before the loop
    const consts = [
      isMods ? `  min_prob <- ${p.modificationThreshold}` : '',
      isQual ? `  max_quality_rects <- 200000` : '',
      !isMods && !isQual
        ? `  filter_low_freq <- ${p.showLowFreqMismatches ? 'FALSE' : 'TRUE'}
  bp_per_px <- ${p.bpPerPx}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    // map the center-line sort position (genomic) onto the cumulative axis
    const sortPosMap = `  sort_pos <- ${p.sortPos ?? -1}
  sr <- which(regions$start <= sort_pos & regions$end > sort_pos)
  sort_pos <- if (length(sr)) sort_pos + (regions$offset[sr[1]] - regions$start[sr[1]]) else -1`
    // layout over the COMBINED reads: consistent rows across regions, and in
    // chain mode a connector spanning a mate/segment split across regions
    const layout = p.linkReads
      ? `  linked <- link_reads(reads)
  reads <- linked$reads`
      : sortType !== undefined
        ? `${sortPosMap}
  # ${SORT_NOTES[sortType]}, then pack rows
  reads <- sorted_pileup_layout(reads, sort_pos, ${rStr(sortType)}${SORT_ARGS[sortType]})`
        : `  reads <- pileup_layout(reads)`
    const connector = p.linkReads
      ? `
    geom_segment(data = linked$links,
      aes(x = xstart, xend = xend, y = row + 0.4, yend = row + 0.4),
      color = "#999999", linewidth = 0.3) +`
      : ''

    // overlays consume the pre-combined frames (already row-joined by read_index
    // into the combined reads). indels: deletion grey rect / spliced intron teal
    // line / insertion purple tick. mismatch/mods/quality per the scheme. clips:
    // soft blue / hard red bars. All independent of the color scheme except the
    // scheme-specific base overlay.
    const indelOverlay = `  # CIGAR indels: deletion (grey rect) / spliced intron (teal line) / insertion (purple tick)
  if (!is.null(indels) && nrow(indels)) {
    indels$row <- reads$row[indels$read_index]
    dels <- indels[indels$type == "D", ]
    skips <- indels[indels$type == "N", ]
    ins <- indels[indels$type == "I", ]
    if (nrow(dels)) {
      p <- p + geom_rect(data = dels,
        aes(xmin = refpos, xmax = refpos + length, ymin = row, ymax = row + 0.8),
        fill = gap_colors[["D"]])
    }
    if (nrow(skips)) {
      # erase the read body across the intron, then draw the thin connector line
      p <- p +
        geom_rect(data = skips,
          aes(xmin = refpos, xmax = refpos + length, ymin = row, ymax = row + 0.8),
          fill = "white") +
        geom_segment(data = skips,
          aes(x = refpos, xend = refpos + length, y = row + 0.4, yend = row + 0.4),
          color = gap_colors[["N"]], linewidth = 0.3)
    }
    if (nrow(ins)) {
      p <- p + geom_segment(data = ins,
        aes(x = refpos, xend = refpos, y = row, yend = row + 0.8),
        color = gap_colors[["I"]], linewidth = 0.8)
    }
  }`
    const modsOverlay = `  # per-base modification ticks (MM/ML), joined to their pileup row and colored
  # by modification type; raise min_prob to hide low-confidence calls like JBrowse
  if (!is.null(mods) && nrow(mods)) {
    mods$row <- reads$row[mods$read_index]
    mods$fill <- mod_colors(mods$modtype)
    p <- p + geom_rect(data = mods,
      aes(xmin = refpos, xmax = refpos + 1, ymin = row, ymax = row + 0.8, fill = fill))
  }`
    const qualOverlay = `  # per-base quality: color every aligned base by its Phred score on JBrowse's
  # perBaseQuality ramp (red low -> green high), joined to its pileup row. This is
  # one rect per aligned base, so like JBrowse it only makes sense zoomed in; over
  # a wide region it would emit millions of rects and exhaust ggplot's memory, so
  # cap it (raise max_quality_rects if you really want a wider view).
  if (!is.null(bq) && nrow(bq)) {
    if (nrow(bq) > max_quality_rects) {
      message(sprintf("perBaseQuality: %d aligned bases in view exceeds max_quality_rects (%d); skipping the per-base overlay. Narrow the region to draw it.", nrow(bq), max_quality_rects))
    } else {
      bq$row <- reads$row[bq$read_index]
      bq$fill <- quality_colors(bq$score)
      p <- p + geom_rect(data = bq,
        aes(xmin = refpos, xmax = refpos + 1, ymin = row, ymax = row + 0.8, fill = fill))
    }
  }`
    const mismatchOverlay = `  # per-base mismatch ticks, joined to their pileup row and colored by read base.
  # JBrowse fades low-frequency mismatches when zoomed out past 1 bp/px and the
  # frequency filter is on (the default): each tick's alpha is pxPerBp lifted
  # toward 1 by its base frequency (count of that base / depth), and a base below
  # snp_freq_threshold(depth) stays at the faint pxPerBp noise floor. Zoomed in
  # (<= 1 bp/px) every tick is opaque. Mirrors frequencyFade + the depth-dependent
  # threshold; the alpha is baked into the fill hex so one scale_fill_identity()
  # still covers read bodies + ticks. Set filter_low_freq <- FALSE to keep all.
  if (!is.null(mm) && nrow(mm)) {
    mm$row <- reads$row[mm$read_index]
    fill <- base_colors[toupper(mm$base)]
    if (filter_low_freq && bp_per_px > 1) {
      alpha <- mismatch_fade_alpha(mm$refpos, mm$base, cov, bp_per_px)
      fill <- paste0(fill, sprintf("%02X", pmin(255L, as.integer(round(alpha * 255)))))
    }
    mm$fill <- fill
    p <- p + geom_rect(data = mm,
      aes(xmin = refpos, xmax = refpos + 1, ymin = row, ymax = row + 0.8, fill = fill))
  }`
    const overlay = isMods
      ? modsOverlay
      : isQual
        ? qualOverlay
        : mismatchOverlay
    const clipOverlay = `  # clip indicator bars (soft = blue, hard = red) at read ends
  if (!is.null(clips) && nrow(clips)) {
    clips$row <- reads$row[clips$read_index]
    clips$color <- clip_colors[clips$type]
    p <- p + geom_segment(data = clips,
      aes(x = pos, xend = pos, y = row, yend = row + 0.8, color = color),
      linewidth = 1) +
      scale_color_identity()
  }`

    fragments.push({
      trackId: p.trackId,
      trackName: p.trackName,
      packages,
      helpers: [
        ...cramHelpers,
        'read_bam',
        'read_filter',
        p.linkReads
          ? 'link_reads'
          : sortType !== undefined
            ? 'sorted_pileup_layout'
            : 'pileup_layout',
        'read_fill_colors',
        ...(isMods
          ? ['bam_modifications', 'mod_colors']
          : isQual
            ? ['bam_base_quality', 'quality_colors']
            : // the mismatch overlay's low-frequency fade needs the coverage depth
              [
                'bam_mismatches',
                'base_colors',
                'bam_coverage',
                'mismatch_fade_alpha',
              ]),
        // base sort reads the mismatch base at sort_pos even when the color
        // scheme wouldn't otherwise pull in bam_mismatches
        ...(sortType === 'base' && (isMods || isQual)
          ? ['bam_mismatches']
          : []),
        // the tag sort needs each read's tag value (the other sorts key off
        // frames the panel already reads: reads / mm / indels / clips)
        ...(sortType === 'tag' && p.sortTag ? ['bam_tag_values'] : []),
        'bam_indels',
        'gap_colors',
        'bam_clips',
        'clip_colors',
      ],
      setup,
      plotVariable: `p_${pathVar}_pileup`,
      heightWeight: 3,
      // read every region (renumbering read_index into the combined reads frame),
      // lay out over the combined reads, then draw the pileup + overlays
      plotExpr: `{
${[pathAlias, filterConsts, consts].filter(Boolean).join('\n')}
  parts <- list(); racc <- 0L
  for (ri in seq_len(nrow(regions))) {
    chrom <- regions$chrom[ri]; start <- regions$start[ri]; end <- regions$end[ri]
    shift <- regions$offset[ri] - regions$start[ri]
    ${bamAssign}
    # clip an overlay frame to the region, shift onto the cumulative axis, and
    # renumber read_index to its row in the combined reads frame
    reg <- function(df, col) {
      if (is.null(df) || !nrow(df)) return(NULL)
      df <- df[df[[col]] >= start & df[[col]] < end, , drop = FALSE]
      if (!nrow(df)) return(NULL)
      df[[col]] <- df[[col]] + shift; df$read_index <- df$read_index + racc; df$.region <- ri
      df
    }
    ${readFilteredReads}
${
  sortType === 'tag' && p.sortTag
    ? `    # the tag sort's key, per read, in the same order — so it rides the
    # reads frame through the multi-region rbind and stays joined to its read
    reads$sort_tag <- bam_tag_values(bam, chrom, start, end, ${rStr(p.sortTag)})\n`
    : ''
}    n <- nrow(reads)
    reads$start <- pmin(pmax(reads$start, start), end) + shift
    reads$end   <- pmin(pmax(reads$end, start), end) + shift
    reads$.region <- ri
    indels <- bam_indels(bam, chrom, start, end)
    clips  <- bam_clips(bam, chrom, start, end)
${loopReads ? `${loopReads}\n` : ''}    parts[[ri]] <- list(reads = reads, indels = reg(indels, "refpos"), clips = reg(clips, "pos")${loopParts.length ? `,\n      ${loopParts.join(', ')}` : ''})
    racc <- racc + n
  }
  reads  <- do.call(rbind, lapply(parts, \`[[\`, "reads"))
  indels <- do.call(rbind, Filter(Negate(is.null), lapply(parts, \`[[\`, "indels")))
  clips  <- do.call(rbind, Filter(Negate(is.null), lapply(parts, \`[[\`, "clips")))
${combine ? `${combine}\n` : ''}${layout}
  # color reads by the track's color-by scheme (edit to try another scheme)
  reads$fill <- read_fill_colors(reads, ${rStr(bodyScheme)})
  p <- ggplot(reads) +${connector}
    geom_rect(aes(xmin = start, xmax = end, ymin = row, ymax = row + 0.8, fill = fill)) +
    scale_fill_identity() +
    scale_y_reverse() +
    labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL) +
    theme_minimal() +
    theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())
${indelOverlay}
${overlay}
${clipOverlay}
  p
}`,
    })
  }

  return fragments
}

/** Read the alignments display's source uri + subtrack visibility into R panels. */
export function exportRCode(
  self: LinearAlignmentsDisplayModel,
): RTrackFragment[] {
  const { trackId, trackName, adapter } = getTrackRMeta<AdapterConf>(self)
  const isCram = adapter.type === 'CramAdapter' || !!adapter.cramLocation?.uri
  return alignmentsFragments({
    trackId,
    trackName,
    uri: firstUri(
      adapter.bamLocation?.uri,
      adapter.cramLocation?.uri,
      adapter.uri,
    ),
    isCram,
    reference: isCram ? referenceFastaUri(self) : '',
    showCoverage: self.showCoverage,
    showPileup: self.showPileup,
    colorBy: self.colorBy.type,
    showLowFreqMismatches: self.showLowFreqMismatches,
    bpPerPx: (getContainingView(self) as { bpPerPx?: number }).bpPerPx ?? 1,
    linkReads: self.linkedReads !== 'off',
    sortType: resolveSortType(self.sortedBy?.type),
    sortPos: self.sortedBy?.pos ?? -1,
    sortTag: self.sortedBy?.tag,
    filterFlagInclude: self.filterBy.flagInclude,
    filterFlagExclude: self.filterBy.flagExclude,
    filterReadName: self.filterBy.readName,
    filterTagFilters: self.filterBy.tagFilters ?? [],
    // JBrowse stores the threshold as a percent (default 10); the R helper wants
    // a 0..1 probability
    modificationThreshold:
      (self.colorBy.modifications?.threshold ??
        DEFAULT_MODIFICATION_THRESHOLD) / 100,
  })
}
