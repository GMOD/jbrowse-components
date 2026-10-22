import { launchTrackWithModifiers } from '@jbrowse/app-core'

import type { AssertNever, AssertTrue, Covers } from './types.ts'
import type { VariantSortColumn } from '@jbrowse/alignments-core/variantSortColumn'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { HeightMode } from '@jbrowse/display-kit/heightMode'
import type {
  ALIGNMENTS_COLOR_FIELDS,
  ALIGNMENTS_COMPACTNESS,
  COLOR_SCHEMES,
  Category,
  DisplaySnapshot,
  FACET_ONLY_FIELDS,
  HEIGHT_MODES,
  READ_CATEGORY_KEYS,
  ReadFilterSnapshot,
} from '@jbrowse/launch-args/displaySettings'
import type {
  COMPACTNESS_PRESETS,
  CategoryFilter,
  FacetOnlyDimension,
  LinearAlignmentsDisplayModel,
  ReadCategoryKey,
  ReadDimension,
} from '@jbrowse/plugin-alignments'
import type { LinearBasicDisplayModel } from '@jbrowse/plugin-canvas'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type {
  LinearMultiSampleVariantDisplayModel,
  LinearVariantDisplayModel,
} from '@jbrowse/plugin-variants'

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
      ]: (typeof COMPACTNESS_PRESETS)[K]['readHeight']
    }
      ? true
      : false
  >,
  AssertTrue<
    Required<ReadFilterSnapshot>[ReadCategoryKey] extends CategoryFilter
      ? true
      : false
  >,
]

// Every DisplaySnapshot key exists on a display model, so a property renamed
// upstream fails the build instead of going dead. The config slots read
// through differently named getters, which `keyof` the instance misses.
type ConfigSlotKey =
  | 'color'
  | 'forceLoad'
  | 'modifications'
  | 'baseColor'
  | 'filter'
  | 'sort'
  | 'pileup'
  | 'readConnections'
  | 'sashimi'
type DisplayKeys =
  | keyof LinearAlignmentsDisplayModel
  | keyof LinearBasicDisplayModel
  | keyof LinearVariantDisplayModel
  | keyof LinearMultiSampleVariantDisplayModel
  | ConfigSlotKey

export type AssertSnapshotKeysExist = AssertNever<
  Exclude<keyof DisplaySnapshot, DisplayKeys>
>

// Two tracks at this ceiling, a sample over its control, are a card a laptop
// window holds without scaling.
const CARD_GROW_MAX_HEIGHT = 250

/**
 * Open a track with its modifiers applied, plus what a batch card and a
 * joined junction add: `sortAt` sorts a card's pileup at its variant, and
 * `joined` draws the arcs between a junction's two ends and puts the SV
 * evidence on top. A track stating otherwise keeps its own.
 */
export async function applyDisplayOpts(
  view: LinearGenomeViewModel,
  trackId: string,
  category: Category,
  opts: string[],
  sortAt?: VariantSortColumn,
  joined = false,
) {
  return launchTrackWithModifiers(view, trackId, category, opts, {
    adjust: ({ snap, sort }) => {
      if (category !== 'alignments') {
        return
      }
      if (joined) {
        if (snap.readConnections?.show === undefined) {
          snap.readConnections = {
            show: true,
            mark: 'arc',
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
        // one row height on every card of a run: a shallow pileup takes the
        // room it needs, and a deep one stops at the ceiling
        if (snap.heightMode === undefined && snap.height === undefined) {
          snap.heightMode = 'grow'
          snap.growMaxHeight ??= CARD_GROW_MAX_HEIGHT
        }
      }
    },
  })
}
