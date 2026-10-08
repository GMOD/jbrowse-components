import { buildSourceSampleIndices } from '../VariantRPC/analyzeVariants.ts'
import { BLACK_ABGR, NO_CALL_COLOR, REFERENCE_COLOR } from './constants.ts'
import { getAlleleColor } from './drawAlleleCount.ts'
import {
  altDosageByte,
  featureHasPhaseSet,
  getPhasedColor,
  isNoCall,
  isPhasedOrHaploid,
  splitPhasedAlleles,
} from './getPhasedColor.ts'
import { makePhaseSetReader } from './phaseSetReader.ts'
import { getCachedABGR } from './variantWebglUtils.ts'

import type { VariantUnit } from './constants.ts'
import type { ProcessedSource } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * Everything a cell loop needs to emit one cell: the packed color plus the two
 * facts the buckets and the insertion pass key off. `null` means the genotype
 * paints nothing here (`''` from `getPhasedColor` / `getAlleleColor`).
 */
export interface VariantCellStyle {
  abgr: number
  isRef: boolean
  isAlt: boolean
  // 0-255 alt dosage; 0 for ref and no-call. Gates and shades the insertion
  // marker (see `altDosageByte`).
  altDosage: number
  // a `CELL_*` index; the cell loops OR `1 << category` into the mask the
  // legend lists
  category: number
}

export const CELL_REF = 0
export const CELL_ALT = 1
export const CELL_ALT_SECONDARY = 2
export const CELL_NO_CALL = 3
export const CELL_UNPHASED = 4
// an alt in its plain hue under phase-set colouring, its call naming no PS
export const CELL_ALT_NO_PHASE_SET = 5

// Classified from the ALLELE, never the color: a mode that blends its no-call
// to a hex would read as alt-carrying (see `altDosageByte`).
function styleForAllele(
  color: string,
  allele: string | undefined,
  secondary = false,
): VariantCellStyle | null {
  if (!color) {
    return null
  }
  const isRef = allele === '0'
  const isAlt = allele !== undefined && allele !== '.' && !isRef
  return {
    abgr: getCachedABGR(color),
    isRef,
    isAlt,
    // per haplotype, so a drawn marker is full strength; the rows carry the
    // zygosity
    altDosage: isAlt ? 255 : 0,
    category: isRef
      ? CELL_REF
      : !isAlt
        ? CELL_NO_CALL
        : secondary
          ? CELL_ALT_SECONDARY
          : CELL_ALT,
  }
}

/**
 * One genotype's style in allele-count (dosage) mode, the same at every site,
 * so `makeSiteStyler` memoizes it per genotype code for the whole fetch.
 *
 * `altDosage` (and so `isAlt`) comes from the genotype, since the dosage shades
 * are colord output and equal no color constant. `isRef` reads the color
 * because `getAlleleColor` returns `REFERENCE_COLOR` by identity for an
 * all-reference call.
 */
function buildAlleleCountStyle(
  genotype: string,
  drawRef: boolean,
): VariantCellStyle | null {
  const color = getAlleleColor(genotype, drawRef)
  if (!color) {
    return null
  }
  const isRef = color === REFERENCE_COLOR
  const altDosage = isRef ? 0 : altDosageByte(genotype)
  const isAlt = altDosage > 0
  return {
    abgr: getCachedABGR(color),
    isRef,
    isAlt,
    altDosage,
    category: isRef ? CELL_REF : isAlt ? CELL_ALT : CELL_NO_CALL,
  }
}

/**
 * One genotype's style at one site for every haplotype row, in phased mode,
 * indexed by `HP` so the per-cell loop is two array reads. An unphased-but-called
 * or no-call genotype paints the same cell on every row, so those fill the
 * whole array.
 *
 * A sample with fewer alleles than `numHaplotypes` (max HP + 1) keeps `null` at
 * the haplotypes it lacks, since drawing there would claim a haplotype it does
 * not carry (see `getPhasedColor`). Phase-set coloring skips this table.
 */
function buildPhasedStyles(
  genotype: string,
  mostFrequentAlt: string,
  numHaplotypes: number,
  drawRef: boolean,
): (VariantCellStyle | null)[] {
  const out: (VariantCellStyle | null)[] = new Array(numHaplotypes)
  if (isPhasedOrHaploid(genotype)) {
    const alleles = splitPhasedAlleles(genotype)
    for (let hp = 0; hp < numHaplotypes; hp++) {
      const allele = alleles[hp]
      out[hp] = styleForAllele(
        getPhasedColor(alleles, hp, mostFrequentAlt, undefined, drawRef),
        allele,
        allele !== mostFrequentAlt,
      )
    }
    return out
  }
  out.fill(uncalledStyle(genotype))
  return out
}

// The two fills of a genotype that isn't phased-or-haploid, shared and
// immutable. A missing unphased call (`./.`, `.`) is a no-call, not the black
// "Unphased" fill.
const NO_CALL_STYLE: VariantCellStyle = {
  abgr: getCachedABGR(NO_CALL_COLOR),
  isRef: false,
  isAlt: false,
  altDosage: 0,
  category: CELL_NO_CALL,
}
const UNPHASED_STYLE: VariantCellStyle = {
  abgr: BLACK_ABGR,
  isRef: false,
  isAlt: false,
  altDosage: 0,
  category: CELL_UNPHASED,
}

function uncalledStyle(genotype: string) {
  return isNoCall(genotype) ? NO_CALL_STYLE : UNPHASED_STYLE
}

/**
 * The phased cell style when coloring by phase set. PS is a per-(feature,
 * sample) FORMAT field, so `buildPhasedStyles`' per-genotype table cannot answer
 * and the color resolves per cell. `isRef`/`isAlt` come from the ALLELE, never
 * the color (see `altDosageByte`).
 *
 * A factory owning one scratch style, as `makePhaseSetReader` does: this runs on
 * the worker's hottest loop, where a fresh object per cell allocates. The
 * result is valid only until the next call.
 */
function makePhaseSetStyler() {
  const scratch: VariantCellStyle = {
    abgr: 0,
    isRef: false,
    isAlt: false,
    altDosage: 0,
    category: CELL_REF,
  }
  return function phaseSetStyle(
    genotype: string,
    HP: number,
    mostFrequentAlt: string,
    phaseSet: string | number | undefined,
    drawRef: boolean,
  ): VariantCellStyle | null {
    if (!isPhasedOrHaploid(genotype)) {
      return uncalledStyle(genotype)
    }
    const alleles = splitPhasedAlleles(genotype)
    const allele = alleles[HP]
    const color = getPhasedColor(
      alleles,
      HP,
      mostFrequentAlt,
      phaseSet,
      drawRef,
    )
    if (!color) {
      return null
    }
    const isRef = allele === '0'
    const isAlt = allele !== undefined && allele !== '.' && !isRef
    scratch.abgr = getCachedABGR(color)
    scratch.isRef = isRef
    scratch.isAlt = isAlt
    scratch.altDosage = isAlt ? 255 : 0
    scratch.category = isRef
      ? CELL_REF
      : !isAlt
        ? CELL_NO_CALL
        : phaseSet !== undefined
          ? CELL_ALT
          : allele === mostFrequentAlt
            ? CELL_ALT_NO_PHASE_SET
            : CELL_ALT_SECONDARY
    return scratch
  }
}

/**
 * One past the highest `HP` any source asks for. A source with no `HP` reads
 * back `undefined` from the table and paints nothing.
 */
function countHaplotypes(sources: { HP?: number }[]) {
  let maxHp = -1
  for (let i = 0; i < sources.length; i++) {
    const hp = sources[i]!.HP
    if (hp !== undefined && hp > maxHp) {
      maxHp = hp
    }
  }
  return maxHp + 1
}

/**
 * Each row's cell style at one site, for both cell loops: bind a site with
 * `site`, then read row `j` with `styleAt(j)`, where `null` paints nothing.
 *
 * The per-genotype memos are indexed by genotype code. The phased one clears
 * per site, for the codes the site used, since its entries bake in that site's
 * most frequent alt.
 *
 * `styleAt` may return `makePhaseSetStyler`'s scratch, so a caller reads the
 * style into its cell arrays before the next call.
 */
export function makeSiteStyler({
  sources,
  sampleNames,
  genotypeDict,
  unit,
  drawRef,
  colorByPhaseSet,
}: {
  sources: ProcessedSource[]
  sampleNames: string[]
  // `genotypeDict[code - 1]` is a code's genotype; code 0 is "no genotype"
  genotypeDict: readonly string[]
  unit: VariantUnit
  drawRef: boolean
  colorByPhaseSet?: boolean
}) {
  const sampleIndices = buildSourceSampleIndices(sources, sampleNames)
  const hps = Int32Array.from(sources, source => source.HP ?? -1)
  const phased = unit === 'haplotype'
  const numHaplotypes = countHaplotypes(sources)
  const phaseSets = makePhaseSetReader(sampleNames)
  const phaseSetStyle = makePhaseSetStyler()
  const numCodes = genotypeDict.length + 1
  const alleleCountStyles = new Array<VariantCellStyle | null | undefined>(
    numCodes,
  )
  const phasedStyles = new Array<(VariantCellStyle | null)[] | undefined>(
    numCodes,
  )
  const touchedCodes: number[] = []
  let codes: Uint32Array = new Uint32Array(0)
  let mostFrequentAlt = ''
  let byPhaseSet = false

  return {
    site(
      feature: Feature,
      siteCodes: Uint32Array,
      siteMostFrequentAlt: string,
    ) {
      codes = siteCodes
      mostFrequentAlt = siteMostFrequentAlt
      for (let t = 0; t < touchedCodes.length; t++) {
        phasedStyles[touchedCodes[t]!] = undefined
      }
      touchedCodes.length = 0
      // `read` is false for a feature that cannot report FORMAT ranges, which
      // paints by allele
      byPhaseSet =
        phased &&
        colorByPhaseSet === true &&
        featureHasPhaseSet(feature.get('FORMAT') as string | undefined) &&
        phaseSets.read(feature)
    },
    styleAt(row: number): VariantCellStyle | null {
      const si = sampleIndices[row]!
      const code = si === -1 ? 0 : codes[si]!
      if (code === 0) {
        return null
      }
      if (!phased) {
        let style = alleleCountStyles[code]
        if (style === undefined) {
          style = buildAlleleCountStyle(genotypeDict[code - 1]!, drawRef)
          alleleCountStyles[code] = style
        }
        return style
      }
      const HP = hps[row]!
      if (byPhaseSet) {
        return phaseSetStyle(
          genotypeDict[code - 1]!,
          HP,
          mostFrequentAlt,
          phaseSets.present[si] ? phaseSets.value[si] : undefined,
          drawRef,
        )
      }
      let byHp = phasedStyles[code]
      if (byHp === undefined) {
        byHp = buildPhasedStyles(
          genotypeDict[code - 1]!,
          mostFrequentAlt,
          numHaplotypes,
          drawRef,
        )
        phasedStyles[code] = byHp
        touchedCodes.push(code)
      }
      return byHp[HP] ?? null
    },
  }
}
