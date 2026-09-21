import { assemblyConfigSchemaFactory } from '@jbrowse/core/assemblyManager'
import {
  hydrateTrackConfig,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { getEnv, getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { hydratedForms, planWebExport } from '@jbrowse/product-core'
import { waitFor } from '@testing-library/react'

import { createViewState, createViewStateAsync } from './index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

function hydratedSnapshot(state: IStateTreeNode, conf: unknown) {
  const { pluginManager } = getEnv<{ pluginManager: PluginManager }>(state)
  return getSnapshot(
    hydrateTrackConfig(pluginManager, conf as Record<string, unknown>)!,
  )
}

jest.mock('./makeWorkerInstance', () => () => {})

const TRACK_ID = 'testtrack'

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'firstId',
          start: 0,
          end: 10,
          seq: 'cattgttgcg',
        },
      ],
    },
  },
}

const DISPLAY_ID = `${TRACK_ID}-LinearBasicDisplay`

const track = {
  type: 'FeatureTrack',
  trackId: TRACK_ID,
  name: 'Original name',
  assemblyNames: ['volvox'],
  adapter: { type: 'FromConfigAdapter', features: [] },
  displays: [
    { type: 'LinearBasicDisplay', displayId: DISPLAY_ID, height: 100 },
  ],
}

interface DeltaSession {
  tracks: AnyConfigurationModel[]
  trackConfigDeltas: Record<string, { trackId: string; [key: string]: unknown }>
  updateTrackConfiguration: (snap: {
    trackId: string
    [k: string]: unknown
  }) => void
}

interface DisplaysHolder {
  displays: { displayId: string; height?: number }[]
}

test('a non-admin edit over a frozen config base merges cleanly (no leaked live nodes)', () => {
  const state = createViewState({ assembly, tracks: [track] })
  const session = state.session as unknown as DeltaSession

  const base = session.tracks.find(t => t.trackId === TRACK_ID)!
  session.updateTrackConfiguration({
    ...(hydratedSnapshot(state, base) as { trackId: string }),
    name: 'Edited name',
  })

  // minimal delta (works whether base is a node or a snapshot, since config
  // nodes proxy property access to values)
  expect(Object.keys(session.trackConfigDeltas[TRACK_ID]!).sort()).toEqual([
    'name',
    'trackId',
  ])

  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
  // the merged config must be plain data — a child config node spread in from
  // the live jbrowse tree would be aliased across two trees
  const adapter = (resolved as unknown as { adapter: unknown }).adapter
  expect(isStateTreeNode(adapter)).toBe(false)
})

test('re-persisting a hydrated config with only injected display stubs stores no delta', () => {
  // a track config that omits `displays`; hydration injects {type, displayId}
  // stubs. Persisting that hydrated snapshot back (no real user edit) must not
  // pin a stub-only delta that would falsely flag the track as overridden.
  const noDisplayTrack = {
    type: 'FeatureTrack',
    trackId: 'nodisplays',
    name: 'No displays',
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  }
  const state = createViewState({ assembly, tracks: [noDisplayTrack] })
  const session = state.session as unknown as DeltaSession

  const base = session.tracks.find(t => t.trackId === 'nodisplays')!
  const hydrated = hydratedSnapshot(state, base) as {
    trackId: string
    displays: unknown[]
  }
  expect(hydrated.displays.length).toBeGreaterThan(0)

  session.updateTrackConfiguration(hydrated)

  expect(session.trackConfigDeltas.nodisplays).toBeUndefined()
})

test('a display-slot edit is a per-display delta, merges by displayId, no leaked nodes', () => {
  const state = createViewState({ assembly, tracks: [track] })
  const session = state.session as unknown as DeltaSession

  const base = session.tracks.find(t => t.trackId === TRACK_ID)!
  const baseSnap = hydratedSnapshot(state, base) as unknown as DisplaysHolder
  const baseDisplayCount = baseSnap.displays.length

  // edit only the configured display's height; the FeatureTrack also
  // auto-materializes other displays which must stay untouched
  session.updateTrackConfiguration({
    ...(hydratedSnapshot(state, base) as { trackId: string }),
    displays: baseSnap.displays.map(d =>
      d.displayId === DISPLAY_ID ? { ...d, height: 321 } : d,
    ),
  })

  // delta carries only the edited display, keyed by displayId, changed slot only
  const delta = session.trackConfigDeltas[TRACK_ID]!
  const deltaDisplays = (delta as unknown as DisplaysHolder).displays
  expect(deltaDisplays).toHaveLength(1)
  expect(deltaDisplays[0]!.displayId).toBe(DISPLAY_ID)
  expect(Object.keys(deltaDisplays[0]!).sort()).toEqual(['displayId', 'height'])
  expect(deltaDisplays[0]!.height).toBe(321)

  // merged config keeps every base display; the edited one gains the slot, and
  // no display is a leaked live node
  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  const merged = resolved as unknown as DisplaysHolder
  expect(merged.displays).toHaveLength(baseDisplayCount)
  expect(merged.displays.find(d => d.displayId === DISPLAY_ID)!.height).toBe(
    321,
  )
  for (const d of merged.displays) {
    expect(isStateTreeNode(d)).toBe(false)
  }
})

test('an edit to a shown catalog track reaches the session snapshot', async () => {
  const state = createViewState({ assembly, tracks: [track] })
  const { view } = state.session
  await view.launchTrack(TRACK_ID)
  await waitFor(() => {
    expect(view.getTrack(TRACK_ID)).toBeTruthy()
  })
  setConf(view.getTrack(TRACK_ID), 'name', 'Edited name')

  await waitFor(() => {
    expect(
      (getSnapshot(state.session) as { trackConfigDeltas?: unknown })
        .trackConfigDeltas,
    ).toEqual({ [TRACK_ID]: expect.objectContaining({ name: 'Edited name' }) })
  })
})

// A non-admin's reset of a slot the admin config sets is a `null` in the delta
// (ADR-146). Each case reads it back through a session rebuilt from its JSON,
// which is what a reload or a share link hands the next session.
describe('a reset of an admin-set slot survives a reload', () => {
  const FST = 'fst'
  const RULES = ['scales', 'y', 'rules'] as const
  const DOMAIN_MAX = ['scales', 'y', 'domainMax'] as const

  function fstTrack(extra: Record<string, unknown>) {
    return {
      type: 'GWASTrack',
      trackId: FST,
      name: 'Fst',
      assemblyNames: ['volvox'],
      adapter: { type: 'GWASAdapter', uri: 'fst.bed.gz' },
      ...extra,
    }
  }
  const rulesBase = fstTrack({
    displayDefaults: { scales: { y: { domainMax: 50, rules: [0.295] } } },
  })
  const rulesDelta = {
    trackId: FST,
    displays: [
      {
        displayId: `${FST}-LinearManhattanDisplay`,
        scales: { y: { rules: null } },
      },
    ],
  }

  interface EditableSession extends DeltaSession {
    sessionTracks: unknown[]
    getTrackConfigChanges: (trackId: string) => unknown[]
    getEditableTrackConfig: (
      trackId: string,
      frozenConfig: unknown,
      schemaType: unknown,
    ) => AnyConfigurationModel
  }

  function sessionOf(state: ReturnType<typeof createViewState>) {
    return state.session as unknown as EditableSession
  }

  function pluginManagerOf(state: IStateTreeNode) {
    return getEnv<{ pluginManager: PluginManager }>(state).pluginManager
  }

  function manhattan(trackConf: AnyConfigurationModel) {
    return (trackConf.displays as AnyConfigurationModel[]).find(
      d => d.type === 'LinearManhattanDisplay',
    )!
  }

  // what BaseTrackModel's persist reaction does: edit the working copy, then
  // hand its snapshot to updateTrackConfiguration
  function edit(
    state: ReturnType<typeof createViewState>,
    change: (trackConf: AnyConfigurationModel) => void,
  ) {
    const session = sessionOf(state)
    const workingCopy = session.getEditableTrackConfig(
      FST,
      session.tracks.find(t => t.trackId === FST),
      pluginManagerOf(state).pluggableConfigSchemaType('track'),
    )
    change(workingCopy)
    session.updateTrackConfiguration(
      getSnapshot(workingCopy) as { trackId: string },
    )
    return workingCopy
  }

  function reload(
    state: ReturnType<typeof createViewState>,
    base: ReturnType<typeof fstTrack>,
  ) {
    return createViewStateAsync({
      assembly,
      tracks: [base],
      session: JSON.parse(JSON.stringify(getSnapshot(state.session))),
    })
  }

  function effective(state: ReturnType<typeof createViewState>) {
    return hydrateTrackConfig(
      pluginManagerOf(state),
      sessionOf(state).tracks.find(t => t.trackId === FST) as unknown as Record<
        string,
        unknown
      >,
    )!
  }

  test('emptying the admin rules list', async () => {
    const state = createViewState({ assembly, tracks: [rulesBase] })
    const workingCopy = edit(state, conf => {
      setConf(manhattan(conf), RULES, [])
    })
    expect(sessionOf(state).trackConfigDeltas[FST]).toEqual(rulesDelta)
    expect(sessionOf(state).getTrackConfigChanges(FST)).toHaveLength(1)
    expect(readConfObject(manhattan(workingCopy), RULES)).toHaveLength(0)

    const display = manhattan(effective(await reload(state, rulesBase)))
    expect(readConfObject(display, RULES)).toHaveLength(0)
    expect(readConfObject(display, DOMAIN_MAX)).toBe(50)
  })

  test('resetting an admin-set scalar, a maybe slot and a track slot', async () => {
    const base = fstTrack({
      description: 'admin description',
      displayDefaults: {
        scatterPointSize: 9,
        scales: { y: { domainMax: 50 } },
      },
    })
    const state = createViewState({ assembly, tracks: [base] })
    const defaultSize = readConfObject(
      manhattan(hydrateTrackConfig(pluginManagerOf(state), fstTrack({}))!),
      'scatterPointSize',
    )
    edit(state, conf => {
      setConf(conf, 'description', undefined)
      setConf(manhattan(conf), 'scatterPointSize', undefined)
      setConf(manhattan(conf), DOMAIN_MAX, undefined)
    })

    const reloaded = effective(await reload(state, base))
    expect(readConfObject(reloaded, 'description')).toBe('')
    expect(readConfObject(manhattan(reloaded), 'scatterPointSize')).toBe(
      defaultSize,
    )
    expect(readConfObject(manhattan(reloaded), DOMAIN_MAX)).toBeUndefined()
  })

  // Both sides of the diff are post-stripDefault, so a slot the admin spelled
  // at its default is absent from both and no reset is inferred for it
  test('a slot the admin wrote at its default takes no null, and a later admin value flows through', async () => {
    const size = readConfObject(
      manhattan(
        effective(createViewState({ assembly, tracks: [fstTrack({})] })),
      ),
      'scatterPointSize',
    ) as number
    const base = fstTrack({ displayDefaults: { scatterPointSize: size } })
    const state = createViewState({ assembly, tracks: [base] })
    edit(state, conf => {
      setConf(manhattan(conf), DOMAIN_MAX, 20)
    })
    expect(sessionOf(state).trackConfigDeltas[FST]).toEqual({
      trackId: FST,
      displays: [
        {
          displayId: `${FST}-LinearManhattanDisplay`,
          scales: { y: { domainMax: 20 } },
        },
      ],
    })

    const adminChanged = fstTrack({
      displayDefaults: { scatterPointSize: size + 3 },
    })
    const display = manhattan(effective(await reload(state, adminChanged)))
    expect(readConfObject(display, 'scatterPointSize')).toBe(size + 3)
    expect(readConfObject(display, DOMAIN_MAX)).toBe(20)
  })

  test('a legacy full-config override that dropped the admin rules migrates to a null', async () => {
    const fresh = createViewState({ assembly, tracks: [rulesBase] })
    const legacy = hydrateTrackConfig(pluginManagerOf(fresh), rulesBase)!
    setConf(manhattan(legacy), RULES, [])

    const state = await createViewStateAsync({
      assembly,
      tracks: [rulesBase],
      session: JSON.parse(
        JSON.stringify({
          ...getSnapshot(fresh.session),
          sessionTracks: [getSnapshot(legacy)],
        }),
      ),
    })
    expect(sessionOf(state).sessionTracks).toEqual([])
    expect(sessionOf(state).trackConfigDeltas[FST]).toEqual(rulesDelta)
    expect(readConfObject(manhattan(effective(state)), RULES)).toHaveLength(0)
  })
})

// Desktop's copy of an edited hub track is what its schema wrote back, and the
// hub's JSON is what its author typed: `uri` shorthand, `displayDefaults`, a
// slot spelled at its default. Only the edit may reach the delta.
test('a desktop export diffs a hub track and assembly through their schemas', () => {
  const hubTrack = {
    type: 'FeatureTrack',
    trackId: 'genes',
    name: 'Genes',
    assemblyNames: ['volvox'],
    adapter: { type: 'Gff3TabixAdapter', uri: 'genes.gff.gz' },
    displays: [
      {
        type: 'LinearBasicDisplay',
        displayId: 'genes-LinearBasicDisplay',
        height: 100,
      },
    ],
    displayDefaults: { color: 'purple' },
  }
  const hubAssembly = {
    name: 'volvox',
    aliases: [],
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      adapter: { type: 'TwoBitAdapter', uri: 'volvox.2bit' },
    },
  }
  const state = createViewState({ assembly, tracks: [hubTrack] })
  const pluginManager = getEnv<{ pluginManager: PluginManager }>(
    state,
  ).pluginManager
  const forms = hydratedForms(
    pluginManager,
    assemblyConfigSchemaFactory(pluginManager),
  )
  const edited = hydrateTrackConfig(pluginManager, structuredClone(hubTrack))!
  setConf(edited, 'name', 'Edited genes')

  const plan = planWebExport(
    {
      assemblies: [forms.assembly(hubAssembly)],
      tracks: [getSnapshot(edited) as { trackId: string }],
      configuration: { sourceConfigUrl: 'https://hub.example/config.json' },
    },
    {
      config: { assemblies: [hubAssembly], tracks: [hubTrack] },
      forms,
    },
  )
  expect(plan.session.trackConfigDeltas).toEqual({
    genes: { trackId: 'genes', name: 'Edited genes' },
  })
  expect(plan.revertedAssemblies).toEqual([])
})
