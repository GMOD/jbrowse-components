import type {
  DisplayEntry,
  RetiredDisplayState,
  RetiredDisplayType,
} from '@jbrowse/core/pluggableElementTypes'

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

// Each v4 display drew one band, and a bare rename to this display would draw
// all of them: a coverage-only track as coverage + pileup, an arcs track as a
// pileup.
export const retiredTypes: RetiredDisplayType[] = [
  {
    type: 'LinearPileupDisplay',
    migrate: entry => ({ showCoverage: false, ...entry }),
  },
  {
    type: 'LinearSNPCoverageDisplay',
    // coverageHeight with height, else the band keeps its 45px default under a
    // 250px display and leaves 200px blank
    migrate: entry => ({
      showPileup: false,
      coverageHeight: 100,
      height: 100,
      ...entry,
    }),
  },
  {
    type: 'LinearReadArcsDisplay',
    migrate: entry => ({
      showPileup: false,
      showCoverage: false,
      readConnections: 'arc',
      ...entry,
    }),
  },
  {
    type: 'LinearReadCloudDisplay',
    migrate: entry => ({
      showPileup: false,
      showCoverage: false,
      readConnections: 'cloud',
      ...entry,
    }),
  },
]

// `methylation`, `stranded` and `insertSizeGradient` were retired before the
// colour object and land on the fields that replaced them.
const V4_COLOR_FIELDS: Record<string, string> = {
  strand: 'strand',
  mappingQuality: 'mapq',
  insertSize: 'insertSize',
  insertSizeGradient: 'insertSize',
  firstOfPairStrand: 'firstOfPairStrand',
  stranded: 'firstOfPairStrand',
  pairOrientation: 'pairOrientation',
  insertSizeAndOrientation: 'insertSizeAndOrientation',
  mateRefName: 'mateRefName',
}

// the v4 schemes that drew a cell per base, the `baseColor` object's now
const V4_BASE_COLOR_FIELDS: Record<string, string> = {
  perBaseQuality: 'baseQuality',
  perBaseLetter: 'base',
  perBaseLettering: 'base',
  modifications: 'modifications',
  methylation: 'modifications',
  bisulfite: 'bisulfite',
}

function colorSlotsOf(value: unknown): DisplayEntry {
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
          ...(type === 'methylation' ? { fillUnmarked: true } : {}),
        }
      : undefined
  return {
    ...(field ? { color: { field } } : {}),
    ...(baseField ? { baseColor: { field: baseField } } : {}),
    ...(settings ? { modifications: settings } : {}),
  }
}

// A v4 `colorBy` named a scheme and held the modification settings, which are
// the `color` or `baseColor` object's field and the `modifications` slot now.
export function retiredConfig(entry: DisplayEntry) {
  if (entry.colorBy === undefined) {
    return entry
  }
  const { colorBy, ...rest } = entry
  return { ...rest, ...colorSlotsOf(colorBy) }
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
  filterBy: value => ({ filterBy: value }),
  filterBySetting: value => ({ filterBy: value }),
  trackMaxHeight: value => ({ maxHeight: value }),
  hideMismatchesSetting: value => ({ showMismatches: !value }),
}

// The pre-4.x display was a container whose track-menu settings sat on these
// sub-nodes; a v4.3.0 session holds both shapes.
const NESTED_SUBNODES = ['PileupDisplay', 'SNPCoverageDisplay']

// a key under both spellings resolves to the `*Setting` one, listed last
function instanceSlotsOf(source: DisplayEntry) {
  const slots: DisplayEntry = {}
  for (const [key, toSlots] of Object.entries(INSTANCE_SLOTS)) {
    if (source[key] !== undefined) {
      Object.assign(slots, toSlots(source[key]))
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
