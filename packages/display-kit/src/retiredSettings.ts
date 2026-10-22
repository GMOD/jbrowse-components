type Snapshot = Record<string, unknown>

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
 * otherwise. `colors: false` leaves the colors behind, for a display whose
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
  const colored = colors ? rows.filter(r => typeof r.color === 'string') : []
  const arrangement = {
    ...(rows.length > 0 ? { sort: rows.map(r => r.key) } : {}),
    ...(labelled.length > 0
      ? { labels: Object.fromEntries(labelled.map(r => [r.key, r.label])) }
      : {}),
    ...(typeof instance.clusterTree === 'string'
      ? { tree: instance.clusterTree }
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
    ...(colored.length > 0
      ? {
          rowColor: {
            scale: {
              domain: colored.map(r => r.key),
              range: colored.map(r => r.color),
            },
          },
        }
      : {}),
  }
}

// Where each member of a flat color object sits in a channel object.
const FLAT_COLOR_MEMBERS: Readonly<
  Record<string, readonly ['scale' | 'legend', string]>
> = {
  scale: ['scale', 'type'],
  domain: ['scale', 'domain'],
  range: ['scale', 'range'],
  labels: ['scale', 'names'],
  scheme: ['scale', 'scheme'],
  reverse: ['scale', 'reverse'],
  domainMin: ['scale', 'domainMin'],
  domainMax: ['scale', 'domainMax'],
  domainMid: ['scale', 'domainMid'],
  domainQuantile: ['scale', 'domainQuantile'],
  unknown: ['scale', 'unknown'],
  title: ['legend', 'title'],
  descending: ['legend', 'descending'],
}

/** Whether `color` is spelt flat, a scale member beside its `field`. */
export function isFlatColor(color: unknown) {
  return (
    isRecord(color) &&
    Object.entries(color).some(
      ([key, value]) =>
        key in FLAT_COLOR_MEMBERS && !(key === 'scale' && isRecord(value)),
    )
  )
}

/**
 * @deprecated The color object as hosted jb2hubs configs still spell it,
 * flat, before ADR-240's channel object, lifted to the channel: scale members
 * under `scale`, `labels` as `scale.names`, `categorical` as `ordinal`, the
 * key's under `legend`. `bare` is what a bare string meant where it was
 * written. Goes once the hosted hub configs regenerate in the channel's
 * spelling.
 */
export function liftFlatColor(
  color: unknown,
  bare: 'value' | 'field',
): Snapshot {
  if (typeof color === 'string') {
    return { [bare]: color }
  }
  if (!isFlatColor(color)) {
    return isRecord(color) ? color : {}
  }
  const out: Snapshot = {}
  const parts: Record<'scale' | 'legend', Snapshot> = { scale: {}, legend: {} }
  for (const [key, value] of Object.entries(color as Snapshot)) {
    const at = FLAT_COLOR_MEMBERS[key]
    if (!at) {
      out[key] = value
    } else if (value !== undefined) {
      parts[at[0]][at[1]] =
        key === 'scale' && value === 'categorical' ? 'ordinal' : value
    }
  }
  for (const part of ['scale', 'legend'] as const) {
    if (Object.keys(parts[part]).length > 0) {
      out[part] = parts[part]
    }
  }
  return out
}

/**
 * @deprecated A display's `color` before `encoding.color`, which hosted
 * jb2hubs configs still write, a bare string being the constant. Goes with
 * `liftFlatColor`.
 */
export const retiredDisplayColor = {
  color: (color: unknown) => ({
    encoding: { color: liftFlatColor(color, 'value') },
  }),
}
