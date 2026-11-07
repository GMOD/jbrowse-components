import { touchesAny, windowsByRegion } from '@jbrowse/display-kit/keyWindows'

import {
  CELL_ALT,
  CELL_ALT_NO_PHASE_SET,
  CELL_ALT_SECONDARY,
  CELL_NO_CALL,
  CELL_UNPHASED,
} from '../shared/variantCellStyles.ts'

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
 * What the key reads off the variants it lists: the absent-data and
 * secondary categories their cells painted, the color values of those that
 * painted an alt cell and of every one (what the records band paints), and
 * their SV classes.
 */
export interface KeyedVariants {
  hasSecondaryAlt: boolean
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
): KeyedVariants {
  let categories = 0
  const altColorValues = new Set<string>()
  const recordColorValues = new Set<string>()
  const svTypes = new Set<string>()
  for (const { data, spans } of payloads) {
    const {
      featurePositions,
      featureCategories,
      featureColorValues,
      colorValues,
      featureInfo,
    } = data
    for (let i = 0; i < featureCategories.length; i++) {
      if (
        touchesAny(
          spans,
          featurePositions[i * 2]!,
          featurePositions[i * 2 + 1]!,
        )
      ) {
        const painted = featureCategories[i]!
        const v = featureColorValues[i]!
        const { svType } = featureInfo[i]!
        categories |= painted
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
  return {
    hasSecondaryAlt: (categories & (1 << CELL_ALT_SECONDARY)) !== 0,
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
export function keyedVariantsFetched(payloads: Iterable<KeyPayload>) {
  return collect([...payloads].map(data => ({ data, spans: EVERYWHERE })))
}

const NO_KEYED_VARIANTS = keyedVariantsFetched([])

/** What {@link keyedVariantViews} reads: the payload and where it shows. */
export interface KeyedVariantHost {
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
