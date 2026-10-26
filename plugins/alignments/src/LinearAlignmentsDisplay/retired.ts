import { COVERAGE_Y_PATHS } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { applyRetiredSpellings } from '@jbrowse/core/configuration'
import { isValidTag } from '@jbrowse/core/util'
import {
  retiredAxisSpellings,
  retiredScaleSpellings,
  retiredScalesSpelling,
  valueScaleOf,
} from '@jbrowse/wiggle-core'

import {
  predicatesOfFilterObject,
  withFields,
} from '../shared/alignmentsFilter.ts'
import { TAG_FIELD_PREFIX } from '../shared/facetLabels.ts'

import type { RetiredSpelling } from '@jbrowse/core/configuration'
import type {
  DisplayEntry,
  RetiredDisplayState,
  RetiredDisplayType,
} from '@jbrowse/core/pluggableElementTypes'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

// The bands a retired type implies, under whatever the entry spells itself:
// an entry writing `pileup: { mark: { height: 3 } }` keeps the implied
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

// the v4 fields that drew a cell per base, `pileup.bases`' fields now
const V4_BASE_COLOR_FIELDS: Record<string, string> = {
  perBaseQuality: 'baseQuality',
  perBaseLettering: 'base',
  modifications: 'modifications',
  methylation: 'modifications',
}

// v4's modification settings, a percent threshold and one isolated type, as
// the `pileup.bases.filter` entries they are
function v4BasesFilterOf(modifications: Record<string, unknown>) {
  const { threshold, isolatedModification } = modifications
  return [
    ...(typeof threshold === 'number'
      ? [{ field: 'probability', gte: threshold / 100 }]
      : []),
    ...(typeof isolatedModification === 'string'
      ? [{ field: 'code', oneOf: [isolatedModification] }]
      : []),
  ]
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
  const given = isObject(modifications) ? modifications : {}
  const filter = v4BasesFilterOf(given)
  return {
    ...(field ? { encoding: { color: { field } } } : {}),
    ...(baseField
      ? {
          pileup: {
            bases: {
              show: true,
              encoding: { color: { field: baseField } },
              ...(filter.length > 0 ? { filter } : {}),
              ...(type === 'methylation' || given.twoColor === true
                ? { unmodified: { show: true } }
                : {}),
            },
          },
        }
      : {}),
  }
}

/**
 * @deprecated The v5 beta's `modifications: { unmodified }`, which ggjbrowse
 * releases before its v5 re-pin write: `calls` and `all` are
 * `pileup.bases.unmodified.show`, and `hidden` its `false`, which a stored
 * delta needs to beat a base that shows it.
 */
export const liftModifications: RetiredSpelling = value =>
  isObject(value) && typeof value.unmodified === 'string'
    ? {
        pileup: {
          bases: { unmodified: { show: value.unmodified !== 'hidden' } },
        },
      }
    : {}

// v4's `mismatchAlpha` switched the fade by base quality
function mismatchFadeOf(on: unknown) {
  return { encoding: { opacity: { field: on ? 'baseQuality' : null } } }
}

// v4's `renderers` block held the pileup renderer's own settings. Its color
// was a callback into the plugin's jexl functions, which went (ADR-163).
function rendererSlotsOf(renderers: unknown): DisplayEntry {
  const pileup = isObject(renderers) ? renderers.PileupRenderer : undefined
  if (!isObject(pileup)) {
    return {}
  }
  const { height, maxHeight, mismatchAlpha, hideMismatches } = pileup
  const mismatches = {
    ...(hideMismatches !== undefined ? { show: !hideMismatches } : {}),
    ...(mismatchAlpha !== undefined ? mismatchFadeOf(mismatchAlpha) : {}),
  }
  const slots = {
    ...(height !== undefined ? { mark: { height } } : {}),
    ...(maxHeight !== undefined ? { maxLayoutHeight: maxHeight } : {}),
    ...(Object.keys(mismatches).length > 0 ? { mismatches } : {}),
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
 * as `retired` declares them. v4's `colorBy` named a field and held the
 * modification settings, which are the `encoding.color` or `pileup.bases`
 * field and `pileup.bases`' `filter` and `unmodified` now; its LinearReadArcsDisplay gated the
 * two arc classes under the draw verb, which are `connection` filter fields
 * now, and its `filterBy` the read fields; `liftV4Filter` reads those three
 * together. Its read size and layout cap are `pileup`'s `mark.height` and
 * `maxLayoutHeight`. The coverage display's scale slots, and v5's `scales.y`,
 * land on the band's `coverage.encoding.y`. `flipStrandLongReadChains` went: a split segment's
 * strand against its molecule is a level of the orientation fields, which
 * `encoding.color.scale.range` recolors. v4's arc `lineWidth` stroked every
 * arc alike, which `readConnections.encoding.strokeWidth.value` does.
 */
// #region retired
export const retiredConfigSpellings: Record<string, RetiredSpelling> = {
  colorBy: colorSlotsOf,
  jexlFilters: () => ({}),
  pileupDisplay: block => subDisplaySlotsOf(block, 'pileup'),
  snpCoverageDisplay: block => subDisplaySlotsOf(block, 'coverage'),
  defaultRendering: () => ({}),
  colorScheme: () => ({}),
  scales: retiredScalesSpelling(COVERAGE_Y_PATHS.members),
  ...retiredScaleSpellings(COVERAGE_Y_PATHS.members),
  multiTicks: () => ({}),
  jitter: () => ({}),
  lineWidth: v => ({
    readConnections: { encoding: { strokeWidth: { value: v } } },
  }),
  featureHeight: v => ({ pileup: { mark: { height: v } } }),
  maxHeight: v => ({ pileup: { maxLayoutHeight: v } }),
  hideSmallIndels: () => ({}),
  hideMismatches: v => ({ pileup: { mismatches: { show: !v } } }),
  mismatchAlpha: v => ({ pileup: { mismatches: mismatchFadeOf(v) } }),
  hideLargeIndels: () => ({}),
  minSubfeatureWidth: () => ({}),
  flipStrandLongReadChains: () => ({}),
  // last: where two lifts land on one member the first declared wins, and a
  // display's own featureHeight or mismatchAlpha beats its renderer's
  renderers: rendererSlotsOf,
}
// #endregion

const isPlainObject = isObject

/**
 * v4's three filter keys on a display config, `filterBy` and the read arcs
 * display's `drawInter` and `drawLongRange`, as one predicate list under the
 * `filter` the snapshot writes, which wins on every field it names. Read
 * together rather than as three `retired` lifts, which would each write
 * `filter` and keep only the first.
 */
export function liftV4Filter(snapshot: Record<string, unknown>) {
  const { filterBy, drawInter, drawLongRange, ...rest } = snapshot
  if (
    filterBy === undefined &&
    drawInter === undefined &&
    drawLongRange === undefined
  ) {
    return snapshot
  }
  const lifted = predicatesOfFilterObject({
    ...(isPlainObject(filterBy) ? filterBy : {}),
    connections: {
      ...(drawInter === false ? { interchrom: 'exclude' } : {}),
      ...(drawLongRange === false ? { offscreenMates: 'exclude' } : {}),
    },
  })
  return {
    ...rest,
    filter: Array.isArray(rest.filter)
      ? overFields(lifted, rest.filter as FieldPredicate[])
      : lifted,
  }
}

// `written`'s entries over `lifted`'s, field by field
function overFields(lifted: FieldPredicate[], written: FieldPredicate[]) {
  return withFields(
    lifted,
    Object.fromEntries(
      [...new Set(written.map(p => p.field))].map(field => [
        field,
        written.filter(p => p.field === field),
      ]),
    ),
  )
}

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
  // v4.3.0's pileup and arcs displays held their key's toggle as state
  showLegend: value =>
    typeof value === 'boolean' ? { legend: { show: value } } : {},
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

// v4.3.0 built the SNP coverage display on the wiggle display, whose axis
// state the coverage band's y scale took over
const COVERAGE_AXIS_KEYS = [
  'scale',
  'autoscale',
  'constraints',
  'displayCrossHatches',
]
const coverageScaleOf = valueScaleOf(COVERAGE_Y_PATHS.members)
const { displayCrossHatches: coverageGridOf } = retiredAxisSpellings(
  COVERAGE_Y_PATHS.members,
)

function mergedTrees(a: DisplayEntry, b: DisplayEntry): DisplayEntry {
  const out: DisplayEntry = { ...a, ...b }
  for (const [key, value] of Object.entries(a)) {
    const other = b[key]
    if (isObject(value) && isObject(other)) {
      out[key] = mergedTrees(value, other)
    }
  }
  return out
}

function coverageAxisOf(source: DisplayEntry) {
  return mergedTrees(
    coverageScaleOf(source),
    typeof source.displayCrossHatches === 'boolean'
      ? coverageGridOf(source.displayCrossHatches)
      : {},
  )
}

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

// The instance lifts build v4's filter object, which merges member by member,
// and leave it as the predicate list once merged
export const retiredState: RetiredDisplayState = {
  keys: [
    ...Object.keys(INSTANCE_SLOTS),
    ...COVERAGE_AXIS_KEYS,
    ...NESTED_SUBNODES,
  ],
  lift: instance => {
    const subNode = NESTED_SUBNODES.map(k => instance[k]).find(isObject)
    const { SNPCoverageDisplay } = instance
    const { filter, ...slots } = underEntry(
      underEntry(
        mergedTrees(
          coverageAxisOf(
            isObject(SNPCoverageDisplay) ? SNPCoverageDisplay : {},
          ),
          coverageAxisOf(instance),
        ),
        subNode ? instanceSlotsOf(subNode) : {},
      ),
      instanceSlotsOf(instance),
    )
    return isObject(filter)
      ? { ...slots, filter: predicatesOfFilterObject(filter) }
      : slots
  },
}
