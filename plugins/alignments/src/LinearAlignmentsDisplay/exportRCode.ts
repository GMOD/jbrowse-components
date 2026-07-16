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
  // sorted_pileup_layout: 'position'/'strand'/'base' order the reads overlapping
  // sortPos. undefined = plain pileup_layout (no sort, or an unsupported type)
  sortType?: 'position' | 'strand' | 'base'
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
// basePair -> base; position/strand pass through; insertion/softclip/hardclip/tag
// aren't reproduced (they need interbase length or tag values the reference-coord
// reader doesn't carry) -> undefined, falling back to plain layout.
function resolveSortType(type: string | undefined) {
  const map: Record<string, 'position' | 'strand' | 'base'> = {
    position: 'position',
    strand: 'strand',
    basePair: 'base',
  }
  return type ? map[type] : undefined
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
 * is the visible, editable `pileup_layout()` helper. Panels read `chrom`,
 * `start`, `end` from the enclosing plot_region().
 */
export function alignmentsFragments(p: AlignmentsRParams): RTrackFragment[] {
  const scheme = resolveColorScheme(p.colorBy)
  const pathVar = safeVarName(p.trackId)
  const refVar = `${pathVar}_ref`
  // Rsamtools can't read CRAM, so a CRAM track reads through a per-region
  // temporary BAM (cram_to_bam) in a distinct variable; a BAM reads its path
  // directly. bamVar is what every bam_* helper call is handed.
  const bamVar = p.isCram ? `${pathVar}_bam` : pathVar
  const setup = p.isCram
    ? `${pathVar} <- ${rStr(p.uri)}\n${refVar} <- ${p.reference ? rStr(p.reference) : 'NULL'}`
    : `${pathVar} <- ${rStr(p.uri)}`
  const cramPrelude = p.isCram
    ? `  # Rsamtools can't read CRAM: decode this region to a temporary BAM first
  ${bamVar} <- cram_to_bam(${pathVar}, chrom, start, end, ${refVar})\n`
    : ''
  const cramHelpers = p.isCram ? ['cram_to_bam'] : []
  const packages = ['Rsamtools', 'GenomicAlignments', 'ggplot2']
  const fragments: RTrackFragment[] = []

  if (p.showCoverage) {
    fragments.push({
      trackId: p.trackId,
      trackName: p.trackName,
      packages,
      helpers: [
        ...cramHelpers,
        'bam_coverage',
        'bam_mismatches',
        'base_colors',
        'bam_indels',
        'bam_clips',
        'interbase_indicators',
        'gap_colors',
        'clip_colors',
        'bp_axis',
      ],
      setup,
      plotVariable: `p_${pathVar}_coverage`,
      heightWeight: 1,
      plotExpr: `{
${cramPrelude}  cov <- bam_coverage(${bamVar}, chrom, start, end)
  mm <- bam_mismatches(${bamVar}, chrom, start, end)
  p <- ggplot() +
    geom_area(data = cov, aes(pos, depth), fill = "#888888") +
    scale_fill_identity() +
    bp_axis() +
    coord_cartesian(xlim = c(start, end)) +
    labs(title = ${rStr(`${p.trackName} coverage`)}, x = NULL, y = "Depth") +
    theme_minimal()
  # stack the per-base mismatch counts (colored) over the grey total = SNP
  # coverage. JBrowse's coverage panel shows every mismatch fraction; the
  # low-frequency fade applies to the pileup ticks, not here (computeSNPCoverage).
  if (!is.null(mm) && nrow(mm)) {
    snp <- aggregate(read_index ~ refpos + base, data = mm, FUN = length)
    names(snp)[names(snp) == "read_index"] <- "count"
    snp$fill <- base_colors[toupper(snp$base)]
    p <- p + geom_col(data = snp, aes(refpos + 0.5, count, fill = fill), width = 1)
  }
  # interbase indicators: a marker above the coverage where insertions / soft- or
  # hard-clips pile up past 30% of local depth (JBrowse's breakpoint flags),
  # colored by the dominant event (insertion purple / softclip blue / hardclip red)
  ind <- interbase_indicators(bam_indels(${bamVar}, chrom, start, end),
                              bam_clips(${bamVar}, chrom, start, end), cov)
  if (nrow(ind)) {
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
    const modsOverlay = `  # per-base modification ticks (MM/ML), joined to their pileup row and colored
  # by modification type; raise to hide low-confidence calls like JBrowse
  min_prob <- ${p.modificationThreshold}
  mm <- bam_modifications(${bamVar}, chrom, start, end, min_prob)
  if (!is.null(mm) && nrow(mm)) {
    mm$row <- reads$row[mm$read_index]
    mm$fill <- mod_colors(mm$modtype)
    p <- p + geom_rect(data = mm,
      aes(xmin = refpos, xmax = refpos + 1, ymin = row, ymax = row + 0.8, fill = fill))
  }`
    const qualOverlay = `  # per-base quality: color every aligned base by its Phred score on JBrowse's
  # perBaseQuality ramp (red low -> green high), joined to its pileup row. This is
  # one rect per aligned base, so like JBrowse it only makes sense zoomed in; over
  # a wide region it would emit millions of rects and exhaust ggplot's memory, so
  # cap it (raise max_quality_rects if you really want a wider view).
  max_quality_rects <- 200000
  bq <- bam_base_quality(${bamVar}, chrom, start, end)
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
  filter_low_freq <- ${p.showLowFreqMismatches ? 'FALSE' : 'TRUE'}
  bp_per_px <- ${p.bpPerPx}
  mm <- bam_mismatches(${bamVar}, chrom, start, end)
  if (!is.null(mm) && nrow(mm)) {
    mm$row <- reads$row[mm$read_index]
    fill <- base_colors[toupper(mm$base)]
    if (filter_low_freq && bp_per_px > 1) {
      alpha <- mismatch_fade_alpha(mm$refpos, mm$base,
        bam_coverage(${bamVar}, chrom, start, end), bp_per_px)
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
    // JBrowse's localized "Sort by..." reorders reads overlapping the center-line
    // column (sort_pos) before packing rows; only in the flat pileup (chain layout
    // packs whole templates, so sorting doesn't apply). base sort needs the MD-tag
    // mismatch base at sort_pos, so it feeds bam_mismatches into the layout.
    const sortType = p.linkReads ? undefined : p.sortType
    // read the region then apply JBrowse's "Filter by" (flags/read name/tags),
    // marking a keep column so the layout drops filtered reads to an NA row
    const readsSetup = `  # JBrowse "Filter by": SAM flags + optional read-name / tag filters (edit freely)
  flag_include <- ${p.filterFlagInclude ?? 0}
  flag_exclude <- ${p.filterFlagExclude ?? 1540}
  read_name <- ${p.filterReadName ? rStr(p.filterReadName) : 'NULL'}
  tag_filters <- ${emitTagFilters(p.filterTagFilters ?? [])}
  reads <- read_filter(read_bam(${bamVar}, chrom, start, end), ${bamVar}, chrom, start, end,
    flag_include, flag_exclude, read_name, tag_filters)`
    // chain layout groups mates + supplementary segments onto one row and draws
    // a connector across each gap (under the read rects, which paint on top)
    const layout = p.linkReads
      ? `${readsSetup}
  linked <- link_reads(reads)
  reads <- linked$reads`
      : sortType === 'base'
        ? `${readsSetup}
  # sort reads by their base at the center-line column (a deletion sorts as '*',
  # ahead of the ACGT bases, like JBrowse), then pack rows
  sort_pos <- ${p.sortPos ?? -1}
  reads <- sorted_pileup_layout(reads, sort_pos, "base",
    bam_mismatches(${bamVar}, chrom, start, end), bam_indels(${bamVar}, chrom, start, end))`
        : sortType !== undefined
          ? `${readsSetup}
  # sort reads by ${sortType} at the center-line column, then pack rows
  sort_pos <- ${p.sortPos ?? -1}
  reads <- sorted_pileup_layout(reads, sort_pos, ${rStr(sortType)})`
          : `${readsSetup}
  reads <- pileup_layout(reads)`
    const connector = p.linkReads
      ? `
    geom_segment(data = linked$links,
      aes(x = xstart, xend = xend, y = row + 0.4, yend = row + 0.4),
      color = "#999999", linewidth = 0.3) +`
      : ''
    // CIGAR indels that read_bam's start..end swallow. Deletions (short) paint a
    // grey full-height rect over the read body (JBrowse's deletion rect). Skips
    // (N, spliced introns, long) instead erase the body and leave a thin teal
    // connector line between the flanking exons (JBrowse's spliced-read look) --
    // a full-height fill there would read as a colored read segment, not a gap.
    // Insertions (thin purple ticks) mark inserted sequence absent from the
    // reference. Drawn after the read body but before the mismatch ticks (which
    // sit on aligned columns, never inside a gap), independent of the color scheme.
    const indelOverlay = `  # CIGAR indels: deletion (grey rect) / spliced intron (teal line) / insertion (purple tick)
  indels <- bam_indels(${bamVar}, chrom, start, end)
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
    // soft-clip (blue) / hard-clip (red) indicator bars at read ends: a
    // fixed-width vertical mark where a read carries unaligned sequence, the
    // same breakpoint signal JBrowse's clip indicators show. Independent of the
    // color scheme, so it draws under every scheme.
    const clipOverlay = `  # clip indicator bars (soft = blue, hard = red) at read ends
  clips <- bam_clips(${bamVar}, chrom, start, end)
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
        'pair_orientation',
        p.linkReads
          ? 'link_reads'
          : sortType !== undefined
            ? 'sorted_pileup_layout'
            : 'pileup_layout',
        // base sort reads the mismatch base at sort_pos even when the color
        // scheme wouldn't otherwise pull in bam_mismatches
        ...(sortType === 'base' ? ['bam_mismatches'] : []),
        'read_fill_colors',
        ...(isMods
          ? ['bam_modifications', 'mod_colors']
          : isQual
            ? ['bam_base_quality', 'quality_colors']
            : // the mismatch overlay's low-frequency fade needs the coverage
              // depth + the depth-dependent threshold
              [
                'bam_mismatches',
                'base_colors',
                'bam_coverage',
                'snp_freq_threshold',
                'mismatch_fade_alpha',
              ]),
        'bam_indels',
        'gap_colors',
        'bam_clips',
        'clip_colors',
        'bp_axis',
      ],
      setup,
      plotVariable: `p_${pathVar}_pileup`,
      heightWeight: 3,
      plotExpr: `{
${cramPrelude}${layout}
  # color reads by the track's color-by scheme (edit to try another scheme)
  reads$fill <- read_fill_colors(reads, ${rStr(bodyScheme)})
  p <- ggplot(reads) +${connector}
    geom_rect(aes(xmin = start, xmax = end, ymin = row, ymax = row + 0.8, fill = fill)) +
    scale_fill_identity() +
    scale_y_reverse() +
    bp_axis() +
    coord_cartesian(xlim = c(start, end)) +
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
