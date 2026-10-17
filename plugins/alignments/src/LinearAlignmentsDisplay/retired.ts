import { applyRetiredSpellings } from '@jbrowse/core/configuration'
import { retiredScaleSpellings } from '@jbrowse/wiggle-core'

import type { RetiredSpelling } from '@jbrowse/core/configuration'
import type {
  DisplayEntry,
  RetiredDisplayState,
  RetiredDisplayType,
} from '@jbrowse/core/pluggableElementTypes'

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

// The bands a retired type implies, under whatever the entry spells itself:
// an entry writing `pileup: { readHeight: 3 }` keeps the implied
// `pileup.show`, as a band member the entry names wins over the implied one.
function underEntry(bands: DisplayEntry, entry: DisplayEntry): DisplayEntry {
  const out: DisplayEntry = { ...bands, ...entry }
  for (const [key, implied] of Object.entries(bands)) {
    const own = entry[key]
    if (isObject(implied) && isObject(own)) {
      out[key] = { ...implied, ...own }
    }
  }
  return out
}

// Each v4 display drew one band, and a bare rename to this display would draw
// all of them: a coverage-only track as coverage + pileup, an arcs track as a
// pileup.
export const retiredTypes: RetiredDisplayType[] = [
  {
    type: 'LinearPileupDisplay',
    migrate: entry => underEntry({ coverage: { show: false } }, entry),
  },
  {
    type: 'LinearSNPCoverageDisplay',
    // coverage.height with height, else the band keeps its 45px default under a
    // 250px display and leaves 200px blank
    migrate: entry =>
      underEntry(
        { pileup: { show: false }, coverage: { height: 100 }, height: 100 },
        entry,
      ),
  },
  {
    type: 'LinearReadArcsDisplay',
    migrate: entry =>
      underEntry(
        {
          pileup: { show: false },
          coverage: { show: false },
          readConnections: { show: true },
        },
        entry,
      ),
  },
  {
    type: 'LinearReadCloudDisplay',
    migrate: entry =>
      underEntry(
        {
          pileup: { show: false },
          coverage: { show: false },
          readConnections: { show: true, mark: 'cloud' },
        },
        entry,
      ),
  },
]

const V4_COLOR_FIELDS: Record<string, string> = {
  strand: 'strand',
  mappingQuality: 'mapq',
  insertSize: 'insertSize',
  stranded: 'firstOfPairStrand',
  pairOrientation: 'pairOrientation',
  insertSizeAndOrientation: 'insertSizeAndOrientation',
  mateRefName: 'mateRefName',
}

// the v4 schemes that drew a cell per base, the `baseColor` object's now
const V4_BASE_COLOR_FIELDS: Record<string, string> = {
  perBaseQuality: 'baseQuality',
  perBaseLettering: 'base',
  modifications: 'modifications',
  methylation: 'modifications',
}

export function colorSlotsOf(value: unknown): DisplayEntry {
  if (!isObject(value)) {
    return {}
  }
  const { type, tag, modifications } = value
  const field =
    type === 'tag' && typeof tag === 'string'
      ? `tags.${tag}`
      : typeof type === 'string'
        ? V4_COLOR_FIELDS[type]
        : undefined
  const baseField =
    typeof type === 'string' ? V4_BASE_COLOR_FIELDS[type] : undefined
  const given = isObject(modifications) ? modifications : undefined
  const { isolatedModification, ...rest } = given ?? {}
  const settings =
    given || type === 'methylation'
      ? {
          ...rest,
          ...(typeof isolatedModification === 'string'
            ? { shownModifications: [isolatedModification] }
            : {}),
          ...(type === 'methylation' ? { unmodified: 'all' } : {}),
        }
      : undefined
  return {
    ...(field ? { color: { field } } : {}),
    ...(baseField ? { baseColor: { field: baseField } } : {}),
    ...(settings ? { modifications: settings } : {}),
  }
}

// v4's `renderers` block held the pileup renderer's own settings. Its color
// was a callback into the plugin's jexl functions, which went (ADR-163).
function rendererSlotsOf(renderers: unknown): DisplayEntry {
  const pileup = isObject(renderers) ? renderers.PileupRenderer : undefined
  if (!isObject(pileup)) {
    return {}
  }
  const { height, maxHeight, mismatchAlpha, hideMismatches } = pileup
  const slots = {
    ...(height !== undefined ? { readHeight: height } : {}),
    ...(maxHeight !== undefined ? { maxHeight } : {}),
    ...(mismatchAlpha !== undefined ? { fadeLowQuality: mismatchAlpha } : {}),
    ...(hideMismatches !== undefined
      ? { showMismatches: !hideMismatches }
      : {}),
  }
  return Object.keys(slots).length > 0 ? { pileup: slots } : {}
}

// v1.2-v4.3's container held the pileup display's config and the coverage
// display's as sub-configs; each lifts onto this display, the coverage one's
// height as the band's.
function subDisplaySlotsOf(block: unknown, band: 'pileup' | 'coverage') {
  if (!isObject(block)) {
    return {}
  }
  const { type: _type, displayId: _displayId, height, ...rest } = block
  return applyRetiredSpellings(retiredConfigSpellings, {
    ...rest,
    ...(band === 'coverage' && height !== undefined
      ? { coverage: { height } }
      : {}),
  })
}

/**
 * The config spellings v1-v4 wrote on this display and the four it retired,
 * as `retired` declares them. v4's `colorBy` named a scheme and held the
 * modification settings, which are the `color` or `baseColor` object's field
 * and the `modifications` slot now; its LinearReadArcsDisplay gated the two
 * arc classes under the draw verb, which are `readConnections.filter`
 * categories now; its read size and layout cap are `pileup`'s `readHeight`
 * and `maxHeight`; its `jexlFilters` has no slot, since
 * `filter` is the read filter object. The coverage display's scale slots land
 * on the band's `scales.y`. `flipStrandLongReadChains` went: a split segment's
 * strand against its molecule is a level of the orientation fields, which
 * `color.range` recolors.
 */
// #region retired
export const retiredConfigSpellings: Record<string, RetiredSpelling> = {
  colorBy: colorSlotsOf,
  drawInter: v =>
    v === false
      ? { readConnections: { filter: { interchrom: 'exclude' } } }
      : {},
  drawLongRange: v =>
    v === false
      ? { readConnections: { filter: { offscreenMates: 'exclude' } } }
      : {},
  filterBy: filter => ({ filter }),
  jexlFilters: () => ({}),
  pileupDisplay: block => subDisplaySlotsOf(block, 'pileup'),
  snpCoverageDisplay: block => subDisplaySlotsOf(block, 'coverage'),
  defaultRendering: () => ({}),
  renderers: rendererSlotsOf,
  colorScheme: () => ({}),
  ...retiredScaleSpellings,
  multiTicks: () => ({}),
  jitter: () => ({}),
  lineWidth: v => ({ readConnections: { lineWidth: v } }),
  featureHeight: v => ({ pileup: { readHeight: v } }),
  maxHeight: v => ({ pileup: { maxHeight: v } }),
  hideSmallIndels: () => ({}),
  hideMismatches: v => ({ pileup: { showMismatches: !v } }),
  mismatchAlpha: v => ({ pileup: { fadeLowQuality: v } }),
  hideLargeIndels: () => ({}),
  minSubfeatureWidth: () => ({}),
  flipStrandLongReadChains: () => ({}),
}
// #endregion

// v4 named a sort by its menu label and counted the position from 1; a
// `Start location` sort was the default order and names nothing here.
const V4_SORT_TYPES: Record<string, string> = {
  'Read strand': 'strand',
  'Base pair': 'basePair',
  tag: 'tag',
}

function sortSlot(value: unknown): DisplayEntry {
  if (!isObject(value)) {
    return {}
  }
  const { type, pos, refName, tag } = value
  const sortType = V4_SORT_TYPES[String(type)]
  return sortType && typeof pos === 'number' && typeof refName === 'string'
    ? { sort: { type: sortType, pos: pos - 1, refName, tag } }
    : {}
}

// The `*Setting` names are what v4.3.0 sessions carry: its mixin declared
// `colorBySetting`/`filterBySetting` and wrote them back out under those
// names. The bare names are for hand-written snapshots.
//
// `hideSmallIndelsSetting` and `hideLargeIndelsSetting` have no slot to go to:
// the feature went rather than moved.
const INSTANCE_SLOTS: Record<string, (value: unknown) => DisplayEntry> = {
  colorBy: colorSlotsOf,
  colorBySetting: colorSlotsOf,
  filterBy: value => ({ filter: value }),
  filterBySetting: value => ({ filter: value }),
  sortedBy: sortSlot,
  trackMaxHeight: value => ({ pileup: { maxHeight: value } }),
  hideMismatchesSetting: value => ({ pileup: { showMismatches: !value } }),
}

// The pre-4.x display was a container whose track-menu settings sat on these
// sub-nodes; a v4.3.0 session holds both shapes.
const NESTED_SUBNODES = ['PileupDisplay', 'SNPCoverageDisplay']

// a key under both spellings resolves to the `*Setting` one, listed last
function instanceSlotsOf(source: DisplayEntry) {
  let slots: DisplayEntry = {}
  for (const [key, toSlots] of Object.entries(INSTANCE_SLOTS)) {
    if (source[key] !== undefined) {
      slots = underEntry(slots, toSlots(source[key]))
    }
  }
  return slots
}

export const retiredState: RetiredDisplayState = {
  keys: [...Object.keys(INSTANCE_SLOTS), ...NESTED_SUBNODES],
  lift: instance => {
    const subNode = NESTED_SUBNODES.map(k => instance[k]).find(isObject)
    return {
      ...(subNode ? instanceSlotsOf(subNode) : {}),
      ...instanceSlotsOf(instance),
    }
  },
}
