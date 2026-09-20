// What building every config schema a session uses costs, and the invariant
// that keeps it a per-track-*type* cost: creating track config nodes builds no
// further types. The numbers this prints are the record behind
// `agent-docs/measurements/config-schema-construction.json`.
interface Phase {
  types: number
  slots: number
}

interface Counter {
  phase: string
  phases: Record<string, Phase>
  slotKeys: Set<string>
}

jest.mock('@jbrowse/mobx-state-tree', () => {
  const actual = jest.requireActual('@jbrowse/mobx-state-tree')
  const counter: Counter = {
    phase: 'module eval',
    phases: {},
    slotKeys: new Set(),
  }
  ;(globalThis as any).__configSchemaCounter = counter

  // A config slot is `stripDefault(union(JexlString, valueModel), default)`, so
  // the union's arguments are what an interned slot type would be keyed on.
  const unionArgs = new WeakMap<object, unknown[]>()
  const ids = new WeakMap<object, number>()
  let nextId = 1
  const idOf = (t: unknown) =>
    t && (typeof t === 'object' || typeof t === 'function')
      ? `#${ids.get(t) ?? (ids.set(t, nextId), nextId++)}`
      : String(t)

  const KINDS = new Set([
    'array',
    'enumeration',
    'frozen',
    'late',
    'map',
    'maybe',
    'model',
    'optional',
    'refinement',
    'snapshotProcessor',
    'stripDefault',
    'union',
  ])
  const types = new Proxy(actual.types, {
    get(target: any, key: string) {
      const orig = target[key]
      if (typeof orig !== 'function' || !KINDS.has(key)) {
        return orig
      }
      return (...args: unknown[]) => {
        const out = orig.apply(target, args)
        const phase = (counter.phases[counter.phase] ??= { types: 0, slots: 0 })
        phase.types++
        if (key === 'union') {
          unionArgs.set(out, args)
        } else if (key === 'stripDefault') {
          const inner = unionArgs.get(args[0] as object)
          if (inner) {
            phase.slots++
            counter.slotKeys.add(
              `${inner.map(idOf).join(',')}|${JSON.stringify(args[1])}`,
            )
          }
        }
        return out
      }
    },
  })
  return { ...actual, types }
})

const counter = () => (globalThis as any).__configSchemaCounter as Counter

async function configuredPluginManager() {
  const { default: PluginManager } = await import('@jbrowse/core/PluginManager')
  const { default: corePlugins } = await import('./corePlugins.ts')
  counter().phase = 'plugin registration'
  const start = performance.now()
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return { pluginManager, ms: performance.now() - start }
}

function trackSnapshots(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    type: 'FeatureTrack',
    trackId: `t${i}`,
    name: `Track ${i}`,
    assemblyNames: ['volvox'],
    adapter: {
      type: 'BedTabixAdapter',
      bedGzLocation: { uri: `t${i}.bed.gz`, locationType: 'UriLocation' },
      index: {
        location: { uri: `t${i}.bed.gz.tbi`, locationType: 'UriLocation' },
      },
    },
  }))
}

const N_TRACKS = 262

test('config schema construction, by phase', async () => {
  const { pluginManager, ms } = await configuredPluginManager()
  const { types } = await import('@jbrowse/mobx-state-tree')
  const trackType = pluginManager.pluggableConfigSchemaType('track')

  counter().phase = `${N_TRACKS} track config nodes`
  const createStart = performance.now()
  types.array(trackType).create(trackSnapshots(N_TRACKS) as any)
  const createMs = performance.now() - createStart

  const { phases, slotKeys } = counter()
  const sum = (k: keyof Phase) =>
    Object.values(phases).reduce((a, p) => a + p[k], 0)
  console.error(
    `config schema construction: ${JSON.stringify(
      {
        phases,
        registrationMs: +ms.toFixed(1),
        createMs: +createMs.toFixed(1),
        totalTypes: sum('types'),
        totalSlots: sum('slots'),
        distinctSlotTypes: slotKeys.size,
      },
      null,
      2,
    )}`,
  )

  // The slot types a session builds are mostly repeats of one another — the
  // headroom any interning of `ConfigSlot` would have, and it is not worth
  // taking. See the measurement record.
  expect(slotKeys.size).toBeLessThan(sum('slots'))
})

test('creating track configs builds no further types', async () => {
  const { pluginManager } = await configuredPluginManager()
  const { types } = await import('@jbrowse/mobx-state-tree')
  const trackType = pluginManager.pluggableConfigSchemaType('track')

  const built = (label: string, n: number) => {
    counter().phase = label
    types.array(trackType).create(trackSnapshots(n) as any)
    return counter().phases[label]!.types
  }
  // Schema construction is per track TYPE. A node instantiation that built
  // types would make config cost scale with the number of tracks in the config.
  expect(built('nodes-2x', 2 * N_TRACKS)).toBeLessThanOrEqual(
    built('nodes-1x', N_TRACKS),
  )
})
