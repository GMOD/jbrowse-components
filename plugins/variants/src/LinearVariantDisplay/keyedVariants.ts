import { touchesAny, windowsByRegion } from '@jbrowse/display-kit/keyWindows'

import { getMinimalDesc } from '../VcfFeature/util.ts'
import { LAST_ALLELE_SLOT } from '../shared/alleleHues.ts'
import {
  ALLELE_SLOT_BIT,
  CELL_ALT,
  CELL_ALT_FOLDED,
  CELL_ALT_NO_PHASE_SET,
  CELL_ALT_SECONDARY,
  CELL_NO_CALL,
  CELL_UNPHASED,
} from '../shared/variantCellStyles.ts'

import type { VariantFeatureInfo } from '../shared/types.ts'
import type { VariantCellData } from './components/computeVariantCells.ts'
import type { KeyWindow } from '@jbrowse/display-kit/keyWindows'

type KeyPayload = Pick<
  VariantCellData,
  | 'featurePositions'
  | 'featureCategories'
  | 'featureColorValues'
  | 'colorValues'
  | 'featureInfo'
>

const ALT_CELLS =
  (1 << CELL_ALT) | (1 << CELL_ALT_SECONDARY) | (1 << CELL_ALT_NO_PHASE_SET)

const EVERYWHERE = [{ start: 0, end: Number.POSITIVE_INFINITY }]

/**
 * An allele hue past the first (`alleleHues.ts`) that a cell painted. `name`
 * is the allele it stands for, where every cell in the hue is one allele of
 * one record. `folded` where alleles ranked past the palette share it.
 */
export interface KeyedAllele {
  slot: number
  name?: string
  folded?: boolean
}

type AlleleInfo = Pick<VariantFeatureInfo, 'ref' | 'alt' | 'alleleBp'>

// An allele as the hover's "Alleles" row spells it, with the path length
// `INFO/ALEN` states for it: its length through the graph, not the size of an
// event against the reference.
function alleleName({ ref, alt, alleleBp }: AlleleInfo, allele: string) {
  const index = Number(allele)
  const altText = alt[index - 1] ?? ''
  const bp = alleleBp[index]
  return altText === '*'
    ? 'spanning deletion'
    : bp === undefined
      ? getMinimalDesc(ref, altText)
      : `${getMinimalDesc(ref, altText)}, ${bp.toLocaleString('en-US')} bp path`
}

/**
 * What the key reads off the variants it lists: the absent-data categories
 * and the allele hues their cells painted, the color values of those that
 * painted an alt cell and of every one (what the records band paints), and
 * their SV classes.
 */
export interface KeyedVariants {
  // the allele hues painted past the first, in slot order
  secondaryAlts: KeyedAllele[]
  // The allele the first hue stands for, where the one record painting it is
  // one whose other alleles the key names too.
  primaryAltName?: string
  hasAltWithoutPhaseSet: boolean
  hasUnphased: boolean
  hasNoCall: boolean
  altColorValues: string[]
  recordColorValues: string[]
  svTypes: string[]
}

function collect(
  payloads: Iterable<{
    data: KeyPayload
    spans: readonly { start: number; end: number }[]
  }>,
  keep?: (featureId: string) => boolean,
): KeyedVariants {
  let categories = 0
  // per allele slot, how many records painted it and the last that did, a
  // record shown in two displayed regions counted once
  const slotRecords = new Uint32Array(LAST_ALLELE_SLOT + 1)
  const slotInfo: (VariantFeatureInfo | undefined)[] = []
  let foldedRecords = 0
  const altColorValues = new Set<string>()
  const recordColorValues = new Set<string>()
  const svTypes = new Set<string>()
  const counted = new Set<string>()
  for (const { data, spans } of payloads) {
    const {
      featurePositions,
      featureCategories,
      featureColorValues,
      colorValues,
      featureInfo,
    } = data
    for (let i = 0; i < featureCategories.length; i++) {
      const info = featureInfo[i]!
      const { svType, featureId } = info
      if (
        touchesAny(
          spans,
          featurePositions[i * 2]!,
          featurePositions[i * 2 + 1]!,
        ) &&
        (!keep || keep(featureId)) &&
        !counted.has(featureId)
      ) {
        counted.add(featureId)
        const painted = featureCategories[i]!
        const v = featureColorValues[i]!
        categories |= painted
        if (painted & (1 << CELL_ALT_SECONDARY)) {
          for (let slot = 0; slot <= LAST_ALLELE_SLOT; slot++) {
            if (
              painted &
              (1 << (slot === 0 ? CELL_ALT : ALLELE_SLOT_BIT + slot))
            ) {
              slotRecords[slot]!++
              slotInfo[slot] = info
            }
          }
          if (painted & (1 << CELL_ALT_FOLDED)) {
            foldedRecords++
          }
        } else if (painted & (1 << CELL_ALT)) {
          slotRecords[0]!++
        }
        if (v > 0) {
          recordColorValues.add(colorValues[v - 1]!)
          if (painted & ALT_CELLS) {
            altColorValues.add(colorValues[v - 1]!)
          }
        }
        if (svType !== '') {
          svTypes.add(svType)
        }
      }
    }
  }
  const nameOf = (slot: number) => {
    const info = slotInfo[slot]
    const allele = info?.altOrder[slot]
    return info && allele !== undefined && slotRecords[slot] === 1
      ? alleleName(info, allele)
      : undefined
  }
  const secondaryAlts: KeyedAllele[] = []
  for (let slot = 1; slot <= LAST_ALLELE_SLOT; slot++) {
    if (slotRecords[slot]! > 0) {
      const folded = slot === LAST_ALLELE_SLOT && foldedRecords > 0
      const name = folded ? undefined : nameOf(slot)
      secondaryAlts.push({
        slot,
        ...(name === undefined ? {} : { name }),
        ...(folded ? { folded } : {}),
      })
    }
  }
  const primaryAltName = nameOf(0)
  return {
    secondaryAlts,
    ...(primaryAltName === undefined ? {} : { primaryAltName }),
    hasAltWithoutPhaseSet: (categories & (1 << CELL_ALT_NO_PHASE_SET)) !== 0,
    hasUnphased: (categories & (1 << CELL_UNPHASED)) !== 0,
    hasNoCall: (categories & (1 << CELL_NO_CALL)) !== 0,
    altColorValues: [...altColorValues],
    recordColorValues: [...recordColorValues],
    svTypes: [...svTypes],
  }
}

/**
 * The variants on screen (ADR-093): those whose span touches a window of the
 * displayed region their payload is keyed by.
 */
export function keyedVariantsInWindows(
  perRegion: Record<string, KeyPayload>,
  windows: readonly KeyWindow[],
) {
  const regions = windowsByRegion(windows)
  return collect(
    Object.entries(perRegion).flatMap(([regionIndex, data]) => {
      const spans = regions.get(Number(regionIndex))
      return spans ? [{ data, spans }] : []
    }),
  )
}

/**
 * Every variant fetched, for a fetch that is already what is shown: the
 * columns fetch only the visible span.
 */
export function keyedVariantsFetched(
  payloads: Iterable<KeyPayload>,
  keep?: (featureId: string) => boolean,
) {
  return collect(
    [...payloads].map(data => ({ data, spans: EVERYWHERE })),
    keep,
  )
}

const NO_KEYED_VARIANTS = keyedVariantsFetched([])

/** What {@link keyedVariantViews} reads: the payload and where it shows. */
interface KeyedVariantHost {
  cellData: { perRegionCellData: Record<string, KeyPayload> } | undefined
  atGenomicPositions: boolean
  keyWindows: readonly KeyWindow[]
}

/**
 * What a variant display keys, which the display and a static export install
 * alike over the windows each shows.
 */
export function keyedVariantViews(self: KeyedVariantHost) {
  return {
    /**
     * #getter
     * What the key lists, read off the variants in `keyWindows` at genomic
     * positions (the fetch is wider than what shows) and off every fetched
     * variant in columns, which fetch only what is shown.
     */
    get keyedVariants() {
      const { cellData } = self
      return cellData
        ? self.atGenomicPositions
          ? keyedVariantsInWindows(cellData.perRegionCellData, self.keyWindows)
          : keyedVariantsFetched(Object.values(cellData.perRegionCellData))
        : NO_KEYED_VARIANTS
    },
  }
}

/**
 * What the records band keys: the records it placed on screen, which leaves
 * out a hidden section's and those past its height.
 */
export function keyedRecordViews(self: {
  cellData: { perRegionCellData: Record<string, KeyPayload> } | undefined
  recordsPlacedOnScreenIds: ReadonlySet<string>
}) {
  return {
    /**
     * #getter
     * The key's reading of the records band's placed records.
     */
    get keyedRecords() {
      const { cellData } = self
      const placed = self.recordsPlacedOnScreenIds
      return cellData
        ? keyedVariantsFetched(Object.values(cellData.perRegionCellData), id =>
            placed.has(id),
          )
        : NO_KEYED_VARIANTS
    },
  }
}
