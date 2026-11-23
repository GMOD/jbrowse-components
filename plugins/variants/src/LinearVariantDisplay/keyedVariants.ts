import { touchesAny, windowsByRegion } from '@jbrowse/display-kit/keyWindows'

import { ABBREVIATE_ALLELE_THRESHOLD, isSymbolic } from '../VcfFeature/util.ts'
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
 * is the allele it stands for, which every row carries or none does: all of
 * them where one record painted every hue past the first, one allele to a
 * hue.
 */
export interface KeyedAllele {
  slot: number
  name?: string
}

type AlleleInfo = Pick<VariantFeatureInfo, 'ref' | 'alt' | 'alleleBp'>

function signedBp(bp: number) {
  return `${bp > 0 ? '+' : ''}${bp.toLocaleString('en-US')} bp`
}

// An allele by its ALT index and exact length beside the reference's, so no
// two of a record read alike however close their lengths; a short
// substitution by its bases. A symbolic allele keeps its own name, with the
// path length `INFO/ALEN` states for it: its length through the graph, not
// the size of an event against the reference.
function alleleName({ ref, alt, alleleBp }: AlleleInfo, allele: string) {
  const index = Number(allele)
  const altText = alt[index - 1] ?? ''
  const bp = alleleBp[index]
  return altText === '*'
    ? 'spanning deletion'
    : isSymbolic(altText)
      ? bp === undefined
        ? altText
        : `${altText}, ${bp.toLocaleString('en-US')} bp path`
      : altText.length === ref.length &&
          altText.length < ABBREVIATE_ALLELE_THRESHOLD
        ? `ALT ${index}, ${altText}`
        : `ALT ${index}, ${altText.length.toLocaleString('en-US')} bp (${signedBp(altText.length - ref.length)})`
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
  // the one whose other alleles the key names.
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
  // How many records painted the first hue and how many a hue past it, and
  // the last of those, a record shown in two displayed regions counted once
  let primaryRecords = 0
  let secondaryRecords = 0
  let secondaryPainted = 0
  let secondaryInfo: VariantFeatureInfo | undefined
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
        if (painted & (1 << CELL_ALT)) {
          primaryRecords++
        }
        if (painted & (1 << CELL_ALT_SECONDARY)) {
          secondaryRecords++
          secondaryPainted = painted
          secondaryInfo = info
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
  const named =
    secondaryRecords === 1 && (secondaryPainted & (1 << CELL_ALT_FOLDED)) === 0
      ? secondaryInfo
      : undefined
  const nameOf = (slot: number) => {
    const allele = named?.altOrder[slot]
    return named && allele !== undefined ? alleleName(named, allele) : undefined
  }
  const secondaryAlts: KeyedAllele[] = []
  for (let slot = 1; slot <= LAST_ALLELE_SLOT; slot++) {
    if (categories & (1 << (ALLELE_SLOT_BIT + slot))) {
      const name = nameOf(slot)
      secondaryAlts.push(name === undefined ? { slot } : { slot, name })
    }
  }
  const primaryAltName =
    primaryRecords === 1 && secondaryPainted & (1 << CELL_ALT)
      ? nameOf(0)
      : undefined
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
