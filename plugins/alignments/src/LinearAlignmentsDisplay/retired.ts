import { applyRetiredSpellings } from '@jbrowse/core/configuration'
import { isValidTag } from '@jbrowse/core/util'
import { retiredScaleSpellings } from '@jbrowse/wiggle-core'

import { TAG_FIELD_PREFIX } from '../shared/facetLabels.ts'

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

// A bare rename would draw every band: a coverage-only track as coverage +
// pileup, a pileup or arcs track with coverage and a sashimi strip. Only v4's
// SNP coverage display drew sashimi arcs.
export const retiredTypes: RetiredDisplayType[] = [
  {
    type: 'LinearPileupDisplay',
    migrate: entry =>
      underEntry(
        { coverage: { show: false }, sashimi: { show: false } },
        entry,
      ),
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
          sashimi: { show: false },
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
          sashimi: { show: false },
          readConnections: { show: true, mark: 'rule' },
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
    ...(maxHeight !== undefined ? { maxLayoutHeight: maxHeight } : {}),
    ...(mismatchAlpha !== undefined
      ? { fadeLowBaseQuality: mismatchAlpha }
      : {}),
    ...(hideMismatches !== undefined
      ? { mismatches: { show: !hideMismatches } }
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
 * arc classes under the draw verb, which are `connection` filter fields
 * now; its read size and layout cap are `pileup`'s `readHeight`
 * and `maxLayoutHeight`; its `jexlFilters` has no slot, since
 * `filter` is the predicate list. A lift here writes the object form, which
 * `liftFilterObject` turns into the list. The coverage display's scale slots land
 * on the band's `scales.y`. `flipStrandLongReadChains` went: a split segment's
 * strand against its molecule is a level of the orientation fields, which
 * `color.range` recolors.
 */
// #region retired
export const retiredConfigSpellings: Record<string, RetiredSpelling> = {
  colorBy: colorSlotsOf,
  drawInter: v =>
    v === false ? { filter: { connections: { interchrom: 'exclude' } } } : {},
  drawLongRange: v =>
    v === false
      ? { filter: { connections: { offscreenMates: 'exclude' } } }
      : {},
  filterBy: filter => ({ filter }),
  jexlFilters: () => ({}),
  pileupDisplay: block => subDisplaySlotsOf(block, 'pileup'),
  snpCoverageDisplay: block => subDisplaySlotsOf(block, 'coverage'),
  defaultRendering: () => ({}),
  colorScheme: () => ({}),
  ...retiredScaleSpellings,
  multiTicks: () => ({}),
  jitter: () => ({}),
  lineWidth: v => ({ readConnections: { lineWidth: v } }),
  featureHeight: v => ({ pileup: { readHeight: v } }),
  maxHeight: v => ({ pileup: { maxLayoutHeight: v } }),
  hideSmallIndels: () => ({}),
  hideMismatches: v => ({ pileup: { mismatches: { show: !v } } }),
  mismatchAlpha: v => ({ pileup: { fadeLowBaseQuality: v } }),
  hideLargeIndels: () => ({}),
  minSubfeatureWidth: () => ({}),
  flipStrandLongReadChains: () => ({}),
  // last: where two lifts land on one member the first declared wins, and a
  // display's own featureHeight or mismatchAlpha beats its renderer's
  renderers: rendererSlotsOf,
}
// #endregion

// v4 named a sort by its menu label and counted the position from 1; a
// `Start location` sort was the default order and names nothing here.
const V4_SORT_FIELDS: Record<string, string> = {
  'Read strand': 'strand',
  'Base pair': 'base',
  tag: 'tag',
}

function sortSlot(value: unknown): DisplayEntry {
  if (!isObject(value)) {
    return {}
  }
  const { type, pos, refName, tag } = value
  const v5 = V4_SORT_FIELDS[String(type)]
  const field =
    v5 !== 'tag'
      ? v5
      : typeof tag === 'string' && isValidTag(tag)
        ? `${TAG_FIELD_PREFIX}${tag}`
        : undefined
  return field && typeof pos === 'number' && typeof refName === 'string'
    ? { sort: { field, pos: pos - 1, refName } }
    : {}
}

// The read members of the object form a v4 filterBy wrote
const V4_READ_MEMBERS = [
  'flagInclude',
  'flagExclude',
  'minMapq',
  'readName',
  'tags',
  'spliced',
  'svSignal',
  'alone',
  'split',
]

// A v4 filterBy was the whole read filter, so its lift names every read member
// it leaves out as unset: merged over a sub-node's or another view's, it
// replaces those members rather than inheriting a tag filter. It never spoke
// for the junctions or connections, which keep what they were.
function wholeFilterOf(value: unknown): DisplayEntry {
  const { tagFilter, ...members } = isObject(value) ? value : {}
  return {
    filter: {
      ...Object.fromEntries(V4_READ_MEMBERS.map(member => [member, null])),
      ...members,
      // v4's one tag filter, under the member the merge replaces
      ...(tagFilter ? { tags: [tagFilter] } : {}),
    },
  }
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
  filterBy: wholeFilterOf,
  filterBySetting: wholeFilterOf,
  sortedBy: sortSlot,
  trackMaxHeight: value => ({ pileup: { maxLayoutHeight: value } }),
  hideMismatchesSetting: value => ({
    pileup: { mismatches: { show: !value } },
  }),
  // the read cloud's "Show singletons" and "Show proper pairs"
  drawSingletons: value =>
    value === false ? { filter: { alone: 'exclude' } } : {},
  drawProperPairs: value =>
    value === false
      ? { readConnections: { ordinaryPairs: { show: false } } }
      : {},
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
    return underEntry(
      subNode ? instanceSlotsOf(subNode) : {},
      instanceSlotsOf(instance),
    )
  },
}
