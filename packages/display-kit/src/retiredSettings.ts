type Snapshot = Record<string, unknown>

/**
 * The refusals a display raises for settings the row-model port retired, and
 * the track-level router that lets a `displayDefaults` spelling reach them.
 *
 * `config` names each retired config slot and what replaced it; `state` lists
 * the retired state-model props. A track's `displays` union runs every
 * member's preprocessor over every entry while it works out which display an
 * entry is, so a snapshot naming another display type is left alone, and one
 * naming no type is a bag of settings headed for this display and is checked.
 */
export function retiredSettings({
  displayType,
  trackType,
  config,
  state,
}: {
  displayType: string
  trackType: string
  config: Record<string, string>
  state: readonly string[]
}) {
  const shorthand = Object.keys(config)

  function isOwnSnapshot(snap: Snapshot) {
    return snap.type === undefined || snap.type === displayType
  }

  function refuseRetiredConfig(snap: Snapshot) {
    const retired = isOwnSnapshot(snap)
      ? shorthand.filter(key => snap[key] !== undefined)
      : []
    if (retired.length) {
      throw new Error(
        `${displayType}: ${retired.map(key => `\`${key}\` is ${config[key]}`).join('; ')}`,
      )
    }
    return snap
  }

  function refuseRetiredState(snap: Snapshot) {
    const retired = isOwnSnapshot(snap) ? state.filter(key => key in snap) : []
    if (retired.length) {
      throw new Error(
        `${retired.join(', ')} on a ${displayType}: the row arrangement is the display config's \`rows\` object (domain, labels, tree, treeProvenance, kept) and its colours \`rowColor\``,
      )
    }
    return snap
  }

  /**
   * A retired key under `displayDefaults` would be dropped by the shorthand
   * router with a console warning, since no display declares it now. Moved
   * onto an explicit entry for this display instead, it meets the refusal
   * above, which names the replacement.
   */
  function routeRetiredShorthand(snap: Snapshot) {
    return moveDisplayDefaults(snap, displayType, shorthand)
  }

  return {
    refuseRetiredConfig,
    refuseRetiredState,
    routeRetiredShorthand,
    routeTrackShorthand: (snap: Snapshot) =>
      snap.type === trackType ? routeRetiredShorthand(snap) : snap,
  }
}

/**
 * `snap` with the `keys` its `displayDefaults` spells moved onto its
 * `displayType` entry, added where the track lists none, so the shorthand
 * router sends them to that display alone. A value the entry spells wins.
 */
export function moveDisplayDefaults(
  snap: Snapshot,
  displayType: string,
  keys: readonly string[],
): Snapshot {
  const written = snap.displayDefaults as Snapshot | undefined
  const moving = keys.filter(key => written?.[key] !== undefined)
  if (!written || !moving.length) {
    return snap
  }
  const moved = Object.fromEntries(moving.map(key => [key, written[key]]))
  const displays = Array.isArray(snap.displays)
    ? (snap.displays as Snapshot[])
    : []
  const own = displays.find(d => d.type === displayType)
  return {
    ...snap,
    displayDefaults: Object.fromEntries(
      Object.entries(written).filter(([key]) => !moving.includes(key)),
    ),
    displays: own
      ? displays.map(d => (d === own ? { ...moved, ...d } : d))
      : [
          ...displays,
          {
            type: displayType,
            displayId: `${snap.trackId}-${displayType}`,
            ...moved,
          },
        ],
  }
}

/**
 * The display state the row displays kept before `rows`: the arrangement, and
 * v4's sidebar width and toggles.
 */
export const RETIRED_ROW_STATE_KEYS = [
  'layout',
  'clusterTree',
  'clusterProvenance',
  'subtreeFilter',
  'treeAreaWidth',
  'showTreeSetting',
  'showSidebarLabelsSetting',
] as const

const isRecord = (v: unknown): v is Snapshot =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const stringOf = (v: unknown) => (typeof v === 'string' ? v : undefined)

/**
 * The config an old session's row display state becomes: `rows` and
 * `rowColor` from the arrangement, and the sidebar slots. A `layout` row answers to its `source` where it has one, which v4's
 * quantitative display kept apart from the `name` it drew, and to its `name`
 * otherwise. `colors: false` leaves the colours behind, for a display whose
 * old layout copied a palette in rather than holding a reader's choice.
 */
export function liftRetiredRowState(
  instance: Snapshot,
  { colors = true }: { colors?: boolean } = {},
): Snapshot {
  const rows = (Array.isArray(instance.layout) ? instance.layout : [])
    .filter(isRecord)
    .flatMap(row => {
      const key = stringOf(row.source) ?? stringOf(row.name)
      const label =
        stringOf(row.label) ??
        (row.source === undefined ? undefined : stringOf(row.name))
      return key === undefined
        ? []
        : [{ key, label: label === key ? undefined : label, color: row.color }]
    })
  const labelled = rows.filter(r => r.label !== undefined)
  const coloured = colors ? rows.filter(r => typeof r.color === 'string') : []
  const arrangement = {
    ...(rows.length > 0 ? { domain: rows.map(r => r.key) } : {}),
    ...(labelled.length > 0
      ? { labels: Object.fromEntries(labelled.map(r => [r.key, r.label])) }
      : {}),
    ...(typeof instance.clusterTree === 'string'
      ? { tree: instance.clusterTree }
      : {}),
    ...(isRecord(instance.clusterProvenance)
      ? { treeProvenance: instance.clusterProvenance }
      : {}),
    ...(Array.isArray(instance.subtreeFilter)
      ? { kept: instance.subtreeFilter }
      : {}),
  }
  return {
    ...(Object.keys(arrangement).length > 0 ? { rows: arrangement } : {}),
    ...(typeof instance.treeAreaWidth === 'number'
      ? { treeAreaWidth: instance.treeAreaWidth }
      : {}),
    ...(typeof instance.showTreeSetting === 'boolean'
      ? { showTree: instance.showTreeSetting }
      : {}),
    ...(typeof instance.showSidebarLabelsSetting === 'boolean'
      ? { showRowLabels: instance.showSidebarLabelsSetting }
      : {}),
    ...(coloured.length > 0
      ? {
          rowColor: {
            domain: coloured.map(r => r.key),
            range: coloured.map(r => r.color),
          },
        }
      : {}),
  }
}
