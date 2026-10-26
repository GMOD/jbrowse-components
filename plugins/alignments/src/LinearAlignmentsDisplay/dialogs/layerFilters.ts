import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import {
  categoryEntries,
  categoryOf,
} from '@jbrowse/display-kit/categoryFilter'

import {
  JUNCTION_CLASSES,
  junctionSource,
} from '../../features/sashimi/junctionClass.ts'
import {
  DEFAULT_MIN_INTERCHROM_READS,
  DEFAULT_MIN_SASHIMI_READS,
  connectionEntries,
  connectionFilterOf,
  junctionEntries,
  junctionFilterOf,
  mergeFilter,
} from '../../shared/alignmentsFilter.ts'
import {
  DEFAULT_BASES_FILTER,
  PROBABILITY,
  basesFilterOf,
  codeEntries,
} from '../../shared/basesFilter.ts'
import { admitsCode } from '../../shared/types.ts'

import type {
  BaseLayer,
  BasesFilter,
  BasesPatch,
  ConnectionFilter,
  JunctionFilter,
  JunctionFilterPatch,
} from '../../shared/types.ts'
import type { ReadConnectionsMode } from '../constants.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { CategoryFilter } from '@jbrowse/display-kit/categoryFilter'

/**
 * A display's filters as the track's config declares them, merged over the
 * defaults as the live ones are: what the dialog's Reset returns it to.
 */
export interface DeclaredFilters {
  filterPredicates: FieldPredicate[]
  junctionFilter: JunctionFilter
  connectionFilter: ConnectionFilter
  basesFilter: BasesFilter
}

/** `DeclaredFilters` off a written `filter` and `pileup.bases.filter`. */
export function declaredFiltersOf(
  filter: unknown,
  basesFilter: unknown,
): DeclaredFilters {
  const filterPredicates = mergeFilter(predicatesOf(filter))
  return {
    filterPredicates,
    junctionFilter: junctionFilterOf(filterPredicates),
    connectionFilter: connectionFilterOf(filterPredicates),
    basesFilter: basesFilterOf(basesFilter),
  }
}

/**
 * What the "More filters..." dialog reads off a display beyond `filter`:
 * the layers whose own filters it offers while they draw. Optional, since a
 * display sharing the dialog (LGVSyntenyDisplay) may draw none of them.
 */
export interface LayerFiltersModel {
  filterPredicates: FieldPredicate[]
  declaredFilters: DeclaredFilters
  showSashimi?: boolean
  junctionFilter?: JunctionFilter
  drawnReadConnections?: ReadConnectionsMode
  showConnectors?: boolean
  connectionFilter?: ConnectionFilter
  baseLayer?: BaseLayer
  basesFilter?: BasesFilter
  detectedModificationTypes?: string[]
  setBases?: (patch: BasesPatch) => void
}

const SPLIT_CLASSES = JUNCTION_CLASSES.filter(
  c => junctionSource(c) === 'split',
)

/** The split-read junctions as a category: hidden when no split class is drawn. */
export function splitJunctionsCategory({
  classes,
}: JunctionFilter): CategoryFilter | undefined {
  const split = classes?.filter(c => SPLIT_CLASSES.includes(c)) ?? SPLIT_CLASSES
  return split.length === 0
    ? 'exclude'
    : classes !== undefined && split.length === classes.length
      ? 'only'
      : undefined
}

/** Each choice clears `junction.class`; only and hide write `junction.source`. */
export function splitJunctionsPatch(
  value: CategoryFilter | undefined,
): JunctionFilterPatch {
  return value === undefined
    ? { classes: undefined }
    : { classes: undefined, sources: [value === 'only' ? 'split' : 'gap'] }
}

/**
 * Which per-base filters the drawn layer applies: the type list wherever
 * modifications draw, and the probability floor in the by-type view (the blue
 * view paints every call). The cytosine context is a Color by row
 * (`cytosineContextItems`), since it picks what the coloring scores.
 */
export function basesRefinementsApplied(model: { baseLayer?: BaseLayer }) {
  const layer = model.baseLayer
  const isMods = layer?.field === 'modifications'
  return {
    code: isMods,
    probability: isMods && !layer.unmodified,
  }
}

/** The dialog's editable state for the layer filters, as a display holds them. */
export interface LayerFilterState {
  alone: CategoryFilter | undefined
  junctions?: {
    split: CategoryFilter | undefined
    minReads: string
  }
  connections?: {
    offscreenMates: CategoryFilter | undefined
    interchrom: CategoryFilter | undefined
    minInterchromReads: string
  }
  bases?: {
    types: string[]
    shown: string[]
    probabilityPercent?: string
    strict: boolean
  }
}

function percentOf(min: number) {
  return `${Number((min * 100).toFixed(2))}`
}

/** The dialog's state off the display, each layer only while it draws. */
export function layerFilterStateOf(model: LayerFiltersModel): LayerFilterState {
  const applied = basesRefinementsApplied(model)
  const types = model.detectedModificationTypes ?? []
  const bases = model.basesFilter
  return {
    alone: categoryOf(model.filterPredicates, 'alone'),
    ...(model.showSashimi && model.junctionFilter
      ? {
          junctions: {
            split: splitJunctionsCategory(model.junctionFilter),
            minReads: `${model.junctionFilter.minReads}`,
          },
        }
      : {}),
    ...((model.drawnReadConnections !== undefined &&
      model.drawnReadConnections !== 'off') ||
    model.showConnectors
      ? model.connectionFilter
        ? {
            connections: {
              offscreenMates: model.connectionFilter.offscreenMates,
              interchrom: model.connectionFilter.interchrom,
              minInterchromReads: `${model.connectionFilter.minInterchromReads}`,
            },
          }
        : {}
      : {}),
    ...(bases && applied.code
      ? {
          bases: {
            types,
            shown: types.filter(t => admitsCode(bases, t)),
            ...(applied.probability
              ? { probabilityPercent: percentOf(bases.probability.min) }
              : {}),
            strict: bases.probability.strict,
          },
        }
      : {}),
  }
}

/** The same state at the track's declared filters, for the dialog's Reset. */
export function declaredLayerFilterState(
  model: LayerFiltersModel,
): LayerFilterState {
  return layerFilterStateOf({ ...model, ...model.declaredFilters })
}

function countOf(value: string, fallback: number) {
  const n = Number(value)
  return value !== '' && Number.isFinite(n) && n >= 1 ? Math.round(n) : fallback
}

/**
 * The `filter` entries the state writes, by field. The split-read choice
 * writes only when it changed from `initial`, since writing it clears a
 * `junction.class` list the dialog has no control for.
 */
export function layerFilterEntries(
  state: LayerFilterState,
  initial: LayerFilterState,
): Record<string, FieldPredicate[]> {
  const { junctions, connections } = state
  return {
    alone: categoryEntries('alone', state.alone),
    ...(junctions
      ? {
          ...(junctions.split === initial.junctions?.split
            ? {}
            : junctionEntries(splitJunctionsPatch(junctions.split))),
          ...junctionEntries({
            minReads: countOf(junctions.minReads, DEFAULT_MIN_SASHIMI_READS),
          }),
        }
      : {}),
    ...(connections
      ? connectionEntries({
          offscreenMates: connections.offscreenMates,
          interchrom: connections.interchrom,
          minInterchromReads: countOf(
            connections.minInterchromReads,
            DEFAULT_MIN_INTERCHROM_READS,
          ),
        })
      : {}),
  }
}

/**
 * The `pileup.bases` write the state makes, undefined where it shows no
 * per-base layer. Unticking every type turns the layer off, since an empty
 * list is "every type"; ticking every type stores none, so a type first seen
 * as more reads stream in still draws.
 */
export function layerBasesPatch(
  state: LayerFilterState,
): BasesPatch | undefined {
  const { bases } = state
  if (!bases) {
    return undefined
  }
  const { strict } = bases
  if (bases.types.length > 0 && bases.shown.length === 0) {
    return { show: false }
  }
  const percent =
    bases.probabilityPercent === undefined
      ? undefined
      : Number(bases.probabilityPercent)
  return {
    filter: {
      ...(bases.types.length > 0
        ? {
            code: codeEntries(
              bases.types.every(t => bases.shown.includes(t))
                ? undefined
                : bases.shown,
            ),
          }
        : {}),
      ...(percent === undefined || !Number.isFinite(percent)
        ? {}
        : {
            [PROBABILITY]:
              percent / 100 === DEFAULT_BASES_FILTER.probability.min && !strict
                ? undefined
                : [
                    {
                      field: PROBABILITY,
                      [strict ? 'gt' : 'gte']:
                        Math.min(Math.max(percent, 0), 100) / 100,
                    },
                  ],
          }),
    },
  }
}
