import { SAM_FLAG_SECOND_IN_PAIR, refWindowToRead } from '@jbrowse/cigar-utils'
import {
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/palette'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  getMethBins,
  getModPositions,
  getModProbabilities,
  getModProbabilityBytes,
  getModTag,
  getModTypes,
  isMethylationFillType,
  matchesCytosineContext,
} from '@jbrowse/modifications-utils'

import { DEFAULT_BASES_FILTER } from '../../shared/basesFilter.ts'
import { forEachMaxProbMod } from '../../shared/getMaxProbModAtEachPosition.ts'
import { admitsCode } from '../../shared/types.ts'
import { getFlags } from '../../shared/util.ts'
import { getColorForModification } from '../../util.ts'
import {
  forEachAlignedBaseInRegion,
  packedCigarOps,
} from '../alignedBaseWalk.ts'

import type { BaseLayer, BasesFilter } from '../../shared/types.ts'
import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'
import type { Feature, Region } from '@jbrowse/core/util'
import type {
  CytosineContext,
  ModificationType,
  ParsedModData,
} from '@jbrowse/modifications-utils'

// Methylated/unmodified display colors, packed once to opaque ABGR (the
// modificationColors / GPU vertex format). Differ from the modification-mode
// colors in shared/modificationData.ts — theme.ts is source of truth, converted
// once here for the worker context.
//
// ABGR_UNMODIFIED is the generic "this base is NOT modified" blue for every
// mode that paints that state — the methylation fill, bisulfite, and two-color
// over any mod type (a low-probability 6mA call paints it too). It is not
// 5mC-specific despite the theme export it comes from; naming it as if it were
// is what hid the missing two-color legend swatch for non-cytosine mods.
const ABGR_5MC_METHYLATED = cssColorToABGR(methylated5mC)
const ABGR_UNMODIFIED = cssColorToABGR(unmethylated5mC)
const ABGR_5HMC_METHYLATED = cssColorToABGR(methylated5hmC)

// getColorForModification + cssColorToABGR are pure functions of the mod code,
// but the mods.forEach loop below hits them once per modified base — thousands
// of times per nanopore read, nearly all the same code ('m'). Memoize the
// packed ABGR per code (globally deterministic) so each distinct code parses
// once for the whole session instead of once per base.
const modColorCache = new Map<string, number>()
function modColorForType(type: string) {
  let color = modColorCache.get(type)
  if (color === undefined) {
    color = cssColorToABGR(getColorForModification(type))
    modColorCache.set(type, color)
  }
  return color
}

export function extractModifications(
  feature: Feature,
  readIndex: number,
  featureStart: number,
  // Already normalized by `getStrand`, which is why nothing here has to
  // re-narrow it for `getModPositions`.
  strand: -1 | 0 | 1,
  region: Pick<Region, 'start' | 'end'>,
  layer: BaseLayer | undefined,
  detectedModifications: Set<string>,
  seenModTypes: Map<string, ModificationType>,
  modificationsData: ModificationEntry[],
): ParsedModData | undefined {
  const mmTag = getModTag(feature)
  if (!mmTag) {
    return
  }

  // Which types this read declares, from the MM tag's HEADERS — no delta walk,
  // no read sequence, no CIGAR. Two things want this and neither wants a
  // position:
  // - detectedModifications lists every type so the menu can offer all of them
  //   (isolation filters what is *rendered*, not what is detected).
  // - seenModTypes collects (strand, type) pairs; the caller resolves simplex
  //   globally once all reads are parsed (see detectSimplexModifications).
  for (const { strand: modStrand, type, base: modBase } of getModTypes(mmTag)) {
    detectedModifications.add(type)
    const key = modStrand + type
    if (!seenModTypes.has(key)) {
      seenModTypes.set(key, { type, base: modBase, strand: modStrand })
    }
  }

  // Everything below places or scores marks, and only the modifications color
  // fields draw any — so a modBAM opened in normal, strand, insert-size or
  // tag coloring stops here. It used to run the whole per-read pipeline
  // regardless (`getModPositions` walks the delta list against the read
  // sequence, which makes BAM decode SEQ for the read), to populate the menu
  // above. That is the ungated cost the old comment on `packedCigarOps`
  // describes, and it is now gated.
  if (layer?.field !== 'modifications') {
    return
  }

  // packedCigarOps, not parseCigar2(feature.get('CIGAR')): parseCigar2 emits
  // `(len << 4) | opIndex`, which is exactly what NUMERIC_CIGAR already holds,
  // so the string form made BAM/CRAM build a CIGAR string out of their packed
  // ops purely for this to parse straight back. Text-only features still get
  // the parse, inside the helper.
  const cigarOps = packedCigarOps(feature)
  if (!cigarOps?.length) {
    return
  }
  const seq = feature.get('seq') as string | undefined
  if (!seq) {
    return
  }
  const window = refWindowToRead(
    cigarOps,
    region.start - featureStart,
    region.end - featureStart,
  )
  const modifications = getModPositions(
    mmTag,
    seq,
    strand,
    window.readStart,
    window.readEnd,
  )
  const filter = layer.filter ?? DEFAULT_BASES_FILTER
  const twoColor = layer.unmodified === true

  // The 2-color view hands 5mC/5hmC to extractMethylation, which weighs them
  // and unmodified against each other per cytosine; the read's other types
  // (a Fiber-seq read's 6mA) are still drawn here. Unticked types leave before
  // the per-position max, so a hidden type never outscores a shown one.
  const drawn = modifications.filter(
    m =>
      admitsCode(filter, m.type) &&
      !(twoColor && isMethylationFillType(m.type)),
  )
  if (drawn.length > 0) {
    const modStrand = strand === -1 ? -1 : 1
    const { min, strict } = filter.probability
    forEachMaxProbMod(
      drawn,
      getModProbabilityBytes(feature),
      cigarOps,
      strand,
      window,
      (refPos, { type, base }, prob) => {
        // twoColor renders every call, painting low-confidence ones in the
        // unmethylated color (with prob = 1-prob = the unmodified confidence);
        // default mode hides calls below the threshold and always paints the mod
        // color at full prob. `isMeth` unifies both without an intermediate alloc.
        if (twoColor || (strict ? prob > min : prob >= min)) {
          const isMeth = !twoColor || prob > 0.5
          modificationsData.push({
            readIndex,
            position: featureStart + refPos,
            base,
            modType: type,
            strand: modStrand,
            color: isMeth ? modColorForType(type) : ABGR_UNMODIFIED,
            prob: isMeth ? prob : 1 - prob,
            noMod: !isMeth,
          })
        }
      },
    )
  }
  // getMethBins reads the scaled ML numbers; the marks above compare raw bytes.
  // Cut to the region, so `extractMethylation` must be handed the same one.
  return {
    modifications,
    probabilities: twoColor ? getModProbabilities(feature) : undefined,
    cigarOps,
    seq,
    fstrand: strand,
    flen: feature.get('end') - feature.get('start'),
    window,
  }
}

/**
 * Paints the 2-color view's cytosine marks, one per cytosine in context, the
 * ones the MM tag left implicit included, each the most likely of 5mC, 5hmC
 * and unmodified.
 *
 * Takes the whole bases filter rather than just its context, because the
 * winner selection below also has to know which codes it left ticked. It did not, and that made the "Modification types"
 * checkboxes inert in this view while the LEGEND read the same predicate and
 * dropped the swatch — so unticking 5hmC removed its key and left its magenta
 * marks on screen, off a box whose whole claim is that it names every color
 * drawn.
 *
 * **A hidden type is excluded from the competition, not from the output**, at
 * every cytosine a ticked type still reports. The fill paints the most likely
 * state among the ticked types plus unmodified, so unticking 5hmC leaves each
 * cytosine reading 5mC-or-not rather than punching a hole wherever 5hmC
 * happened to win — which is what the menu's own help text asks for ("untick
 * 5hmC to read gene-body 5mC on a 5mCG_5hmCG model"). Dropping a hidden type's
 * probability from the no-mod sum falls out of the same rule and is the honest
 * reading of it: with only 5mC ticked, blue is `1 - P(5mC)`, the confidence the
 * base is not 5mC.
 *
 * The qualifier is load-bearing where the read declares ONE of the pair. A
 * cytosine reaches the loop through a ticked type's bins, and `methBins` is
 * also what carries getMethBins' implicitly-unmethylated fill — so on an
 * ordinary `C+m` modBAM, unticking 5mC leaves nothing marking the cytosines at
 * all and the channel goes blank rather than turning uniformly blue. Nothing is
 * left to read 5hmC-or-not against.
 */
export function extractMethylation(
  readIndex: number,
  featureStart: number,
  strand: number,
  region: Region,
  modData: ParsedModData,
  modificationsData: ModificationEntry[],
  filter: BasesFilter = DEFAULT_BASES_FILTER,
) {
  const showMeth = admitsCode(filter, 'm')
  const showHydroxy = admitsCode(filter, 'h')
  if (
    (!showMeth && !showHydroxy) ||
    !modData.modifications.some(m => isMethylationFillType(m.type))
  ) {
    return
  }
  const { start: regionStart, end: regionEnd } = region
  const { refStart, methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } =
    getMethBins(modData, filter.context, true, type => admitsCode(filter, type))

  const methStrand = strand === -1 ? -1 : 1
  const kStart = Math.max(0, regionStart - featureStart - refStart)
  const kEnd = Math.min(methBins.length, regionEnd - featureStart - refStart)

  for (let k = kStart; k < kEnd; k++) {
    const hasMeth = showMeth && methBins[k]
    const hasHydroxy = showHydroxy && hydroxyMethBins[k]
    if (!hasMeth && !hasHydroxy) {
      continue
    }
    // 5mC and 5hmC are competing modifications of the same cytosine, so their
    // likelihoods plus the implicit unmodified call sum to 1 (SAMtags). A model
    // that emits both (e.g. ONT 5mCG_5hmCG) reports a 5hmC probability at every
    // CpG, almost always low. Drawing each channel as its own methylated/
    // unmethylated mark therefore painted an "unmethylated 5hmC" mark at nearly
    // every CpG, flooding the view. Instead pick the single most-likely state
    // per cytosine — 5mC, 5hmC, or unmodified — mirroring IGV's no-mod logic.
    const mProb = hasMeth ? methProbs[k]! : 0
    const hProb = hasHydroxy ? hydroxyMethProbs[k]! : 0
    const noModProb = Math.max(0, 1 - mProb - hProb)

    // Winner selection, allocation-free: pick 5hmC, then 5mC, else the no-mod
    // bucket. Each color is a module-level packed constant (no per-cytosine work).
    const isHydroxy = hProb > mProb && hProb > noModProb
    const isMeth = !isHydroxy && mProb > noModProb
    modificationsData.push({
      readIndex,
      position: featureStart + refStart + k,
      base: 'C',
      modType: isHydroxy ? 'h' : 'm',
      strand: methStrand,
      color: isHydroxy
        ? ABGR_5HMC_METHYLATED
        : isMeth
          ? ABGR_5MC_METHYLATED
          : ABGR_UNMODIFIED,
      prob: isHydroxy ? hProb : isMeth ? mProb : noModProb,
      noMod: !isHydroxy && !isMeth,
    })
  }
}

// Bisulfite/EM-seq has no MM/ML tags: methylation is read from C->T conversion
// against the reference. Unmethylated C is converted (read T); methylated C is
// protected (read C). Produces the same methylated/unmethylated marks as the
// modBAM methylation path so all downstream rendering is shared.
//
// `callCounts` tallies every informative call per position, methylated or not,
// while `modificationsData` gets only the marks `twoColor` paints. They differ
// in single-color mode and that is the point: the coverage bar's denominator
// is a measurement, not a count of what got drawn (computeBisulfiteCoverage).
export function extractBisulfite(
  feature: Feature,
  readIndex: number,
  featureStart: number,
  strand: number,
  region: Region,
  regionSequence: string,
  regionSequenceStart: number,
  context: CytosineContext,
  twoColor: boolean,
  modificationsData: ModificationEntry[],
  callCounts: Map<number, number>,
) {
  // packed ops rather than a CIGAR string, for the reason in
  // extractModifications above
  const cigarOps = packedCigarOps(feature)
  const seq = feature.get('seq') as string | undefined
  if (!cigarOps?.length || !seq) {
    return
  }
  const flags = getFlags(feature)
  const isReverse = strand === -1
  const isSecondOfPair = (flags & SAM_FLAG_SECOND_IN_PAIR) !== 0

  // Bisulfite converts only the read's own template strand. That strand is
  // reverse XOR second-of-pair (IGV's rule). On it we read genomic C as read
  // C=methylated / T=unmethylated; otherwise genomic G as read G / A. The
  // reference (regionSequence) is lowercased; read bases are uppercased.
  const flip = isReverse !== isSecondOfPair
  const wantRef = flip ? 'g' : 'c'
  const methRead = flip ? 'G' : 'C'
  const unmethRead = flip ? 'A' : 'T'
  const methStrand = isReverse ? -1 : 1
  const refLen = regionSequence.length

  forEachAlignedBaseInRegion(
    cigarOps,
    featureStart,
    region,
    1,
    (genomicPos, queryOffset) => {
      const ri = genomicPos - regionSequenceStart
      if (
        ri >= 0 &&
        ri < refLen &&
        regionSequence[ri] === wantRef &&
        matchesCytosineContext(regionSequence, ri, flip, context)
      ) {
        const readBase = seq[queryOffset]?.toUpperCase()
        const methylated = readBase === methRead
        const unmethylated = readBase === unmethRead
        if (methylated || unmethylated) {
          callCounts.set(genomicPos, (callCounts.get(genomicPos) ?? 0) + 1)
        }
        // Single-color mode (twoColor false) draws only the methylated
        // (protected) sites and leaves the unmethylated ones blank, like
        // IGV's non-2-color bisulfite view.
        if (methylated || (unmethylated && twoColor)) {
          // Bisulfite is a binary call (converted vs protected), not a
          // likelihood — full confidence either way. Methylated paints the
          // 5mC color, unmethylated the no-mod color.
          modificationsData.push({
            readIndex,
            position: genomicPos,
            base: 'C',
            modType: 'm',
            strand: methStrand,
            color: methylated ? ABGR_5MC_METHYLATED : ABGR_UNMODIFIED,
            prob: 1,
            noMod: !methylated,
          })
        }
      }
    },
  )
}
