import {
  displayCategory,
  requestedDisplayType,
} from '@jbrowse/launch-args/displaySettings'
import { launchTrackWithModifiers } from '@jbrowse/plugin-linear-genome-view'

import type { AssertNever, AssertTrue, Covers } from './types.ts'
import type { VariantSortColumn } from '@jbrowse/alignments-core/variantSortColumn'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { HeightMode } from '@jbrowse/display-kit/heightMode'
import type {
  ALIGNMENTS_COLOR_FIELDS,
  ALIGNMENTS_COMPACTNESS,
  COLOR_SCHEMES,
  DisplaySnapshot,
  FACET_ONLY_FIELDS,
  FilterEntry,
  HEIGHT_MODES,
  READ_CATEGORY_KEYS,
} from '@jbrowse/launch-args/displaySettings'
import type {
  COMPACTNESS_PRESETS,
  FacetOnlyDimension,
  LinearAlignmentsDisplayModel,
  ReadCategoryKey,
  ReadDimension,
} from '@jbrowse/plugin-alignments'
import type { LinearBasicDisplayModel } from '@jbrowse/plugin-features'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { LinearVariantDisplayModel } from '@jbrowse/plugin-variants'

// launch-args copies these lists from the plugins so it imports none of them;
// each assertion fails the build when its copy drifts from the plugin's.
type Differ<A extends string, B extends string> = Exclude<A, B> | Exclude<B, A>

export type AssertDisplaySettingsMatchPlugins = [
  AssertNever<Differ<FacetOnlyDimension, (typeof FACET_ONLY_FIELDS)[number]>>,
  AssertTrue<
    Covers<
      Exclude<ReadDimension, FacetOnlyDimension>,
      typeof ALIGNMENTS_COLOR_FIELDS
    >
  >,
  AssertNever<Differ<ReadCategoryKey, (typeof READ_CATEGORY_KEYS)[number]>>,
  AssertNever<Differ<ColorSchemeName, (typeof COLOR_SCHEMES)[number]>>,
  AssertNever<Differ<HeightMode, (typeof HEIGHT_MODES)[number]>>,
  AssertTrue<
    typeof ALIGNMENTS_COMPACTNESS extends {
      [
        K in keyof typeof COMPACTNESS_PRESETS
      ]: (typeof COMPACTNESS_PRESETS)[K]['height']
    }
      ? true
      : false
  >,
  AssertTrue<FilterEntry extends FieldPredicate ? true : false>,
  AssertNever<Differ<keyof FilterEntry, keyof FieldPredicate>>,
]

// Config slots read through differently named getters, which `keyof` the
// instance misses.
type ConfigSlotKey =
  | 'encoding'
  | 'legend'
  | 'forceLoad'
  | 'filter'
  | 'sort'
  | 'pileup'
  | 'readConnections'
  | 'sashimi'
  | 'mark'
type DisplayKeys =
  | keyof LinearAlignmentsDisplayModel
  | keyof LinearBasicDisplayModel
  | keyof LinearVariantDisplayModel
  | ConfigSlotKey

export type AssertSnapshotKeysExist = AssertNever<
  Exclude<keyof DisplaySnapshot, DisplayKeys>
>

// two tracks at this height fit a laptop window unscaled
const CARD_GROW_MAX_HEIGHT = 250

// `sortAt` and `joined` defaults yield to anything the track states itself
export async function applyDisplayOpts(
  view: LinearGenomeViewModel,
  trackId: string,
  displayType: string | undefined,
  opts: string[],
  sortAt?: VariantSortColumn,
  joined = false,
) {
  const entry = await launchTrackWithModifiers(
    view,
    trackId,
    displayType,
    opts,
    {
      adjust: ({ snap, sort }) => {
        if (displayCategory(displayType) !== 'alignments') {
          return
        }
        if (joined) {
          if (snap.readConnections?.show === undefined) {
            snap.readConnections = {
              show: true,
              mark: 'link',
              ...snap.readConnections,
            }
          }
          snap.sort ??= 'svSignal'
        }
        if (sortAt) {
          const [region] = view.displayedRegions
          if (!sort && region) {
            snap.sort = { ...sortAt, refName: region.refName }
          }
          if (snap.heightMode === undefined && snap.height === undefined) {
            snap.heightMode = 'grow'
            snap.growMaxHeight ??= CARD_GROW_MAX_HEIGHT
          }
        }
      },
    },
  )
  if (!entry) {
    const reason = view.problems.at(-1)?.message
    const displayType = requestedDisplayType(opts)
    throw new Error(
      `Failed to open track "${trackId}"${displayType ? ` with display "${displayType}"` : ''}${reason ? `: ${reason}` : ''}`,
    )
  }
  return entry
}
