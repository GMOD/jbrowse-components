import {
  getRoot,
  getType,
  resolveIdentifier,
  types,
  unprotect,
} from '@jbrowse/mobx-state-tree'
import { runInAction } from 'mobx'

import {
  analyzeWebPortability,
  buildWebExportUrl,
  filterSessionInPlace,
  planWebExport,
} from './sessionUtils.ts'

const Item = types.model('Item', {
  id: types.identifier,
  name: types.string,
})

const Container = types.model('Container', {
  items: types.map(Item),
  refs: types.map(types.reference(Item)),
})

test('filterSessionInPlace removes stale references from maps', () => {
  const container = Container.create({
    items: { a: { id: 'a', name: 'A' }, b: { id: 'b', name: 'B' } },
    refs: { a: 'a', b: 'b' },
  })
  unprotect(container)
  runInAction(() => {
    container.items.delete('b')
    filterSessionInPlace(container, getType(container))
  })
  expect([...container.refs.keys()]).toEqual(['a'])
})

const ArrayContainer = types.model('ArrayContainer', {
  items: types.map(Item),
  refs: types.array(types.reference(Item)),
})

test('filterSessionInPlace removes stale references from arrays', () => {
  const container = ArrayContainer.create({
    items: { a: { id: 'a', name: 'A' }, b: { id: 'b', name: 'B' } },
    refs: ['a', 'b'],
  })
  unprotect(container)
  runInAction(() => {
    container.items.delete('b')
    filterSessionInPlace(container, getType(container))
  })
  expect(container.refs.map(r => r.id)).toEqual(['a'])
})

// A child whose property read throws stands in for an open track whose
// `configuration` reference resolves to a structurally-invalid config and
// fails to hydrate.
const ExplodingChild = types.model('ExplodingChild', {
  id: types.identifier,
  target: types.reference(Item, {
    get(id, parent) {
      const item = resolveIdentifier(Item, getRoot(parent), id)
      if (!item) {
        throw new Error(`cannot hydrate "${id}"`)
      }
      return item
    },
    set(value: { id: string }) {
      return value.id
    },
  }),
})

const ExplodingContainer = types.model('ExplodingContainer', {
  items: types.map(Item),
  children: types.array(ExplodingChild),
})

test('filterSessionInPlace drops an element whose walk throws, keeps the rest', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const container = ExplodingContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: [
      { id: 'good', target: 'a' },
      { id: 'bad', target: 'broken' },
    ],
  })
  unprotect(container)
  runInAction(() => {
    filterSessionInPlace(container, getType(container))
  })
  expect(container.children.map(c => c.id)).toEqual(['good'])
  errorSpy.mockRestore()
})

// The array walk splices in place while iterating; two adjacent bad elements
// must both go without the splice skipping the second.
test('filterSessionInPlace drops multiple adjacent throwing array elements', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const container = ExplodingContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: [
      { id: 'bad1', target: 'x' },
      { id: 'bad2', target: 'y' },
      { id: 'good', target: 'a' },
      { id: 'bad3', target: 'z' },
    ],
  })
  unprotect(container)
  runInAction(() => {
    filterSessionInPlace(container, getType(container))
  })
  expect(container.children.map(c => c.id)).toEqual(['good'])
  errorSpy.mockRestore()
})

const ExplodingMapContainer = types.model('ExplodingMapContainer', {
  items: types.map(Item),
  children: types.map(ExplodingChild),
})

// The map walk deletes keys while iterating map.keys(); several bad entries in a
// row must all be dropped (guards against a concurrent-modification skip).
test('filterSessionInPlace drops multiple throwing map elements', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const container = ExplodingMapContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: {
      bad1: { id: 'bad1', target: 'x' },
      good1: { id: 'good1', target: 'a' },
      bad2: { id: 'bad2', target: 'y' },
      bad3: { id: 'bad3', target: 'z' },
      good2: { id: 'good2', target: 'a' },
    },
  })
  unprotect(container)
  runInAction(() => {
    filterSessionInPlace(container, getType(container))
  })
  expect([...container.children.keys()].sort()).toEqual(['good1', 'good2'])
  errorSpy.mockRestore()
})

// Models a track (resolvable `configuration` reference) whose subtree contains
// a child that throws when instantiated — standing in for a display whose
// afterAttach reads view.width before the view is measured. The walk must
// validate the track via its config reference WITHOUT descending into the
// subtree, so a throwing child can't make a valid track get dropped.
const ConfigBearingChild = types.model('ConfigBearingChild', {
  id: types.identifier,
  configuration: types.reference(Item, {
    get(id, parent) {
      const item = resolveIdentifier(Item, getRoot(parent), id)
      if (!item) {
        throw new Error(`cannot hydrate config "${id}"`)
      }
      return item
    },
    set(value: { id: string }) {
      return value.id
    },
  }),
  // never reached by the walk; throws if it ever is
  subtree: types.array(ExplodingChild),
})

const ConfigBearingContainer = types.model('ConfigBearingContainer', {
  items: types.map(Item),
  children: types.array(ConfigBearingChild),
})

test('filterSessionInPlace validates a config-bearing element by its config, not by walking its subtree', () => {
  const container = ConfigBearingContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: [
      // valid config; a child in its subtree would throw if walked
      {
        id: 'keep',
        configuration: 'a',
        subtree: [{ id: 'boom', target: 'x' }],
      },
    ],
  })
  unprotect(container)
  runInAction(() => {
    filterSessionInPlace(container, getType(container))
  })
  expect(container.children.map(c => c.id)).toEqual(['keep'])
})

test('filterSessionInPlace drops a config-bearing element whose config is dangling and reports it', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const container = ConfigBearingContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: [
      { id: 'keep', configuration: 'a' },
      { id: 'drop', configuration: 'missing' },
    ],
  })
  unprotect(container)
  const dropped = runInAction(() =>
    filterSessionInPlace(container, getType(container)),
  )
  expect(container.children.map(c => c.id)).toEqual(['keep'])
  expect(dropped).toEqual([{ type: undefined, configuration: 'missing' }])
  errorSpy.mockRestore()
})

test('analyzeWebPortability reports an all-remote session as portable', () => {
  const snap = {
    assemblies: [
      {
        name: 'hg38',
        sequence: {
          trackId: 'hg38-ref',
          adapter: {
            type: 'TwoBitAdapter',
            twoBitLocation: {
              locationType: 'UriLocation',
              uri: 'https://example.com/hg38.2bit',
            },
          },
        },
      },
    ],
    tracks: [
      {
        trackId: 't1',
        name: 'remote bam',
        adapter: {
          bamLocation: {
            locationType: 'UriLocation',
            uri: 'https://example.com/a.bam',
          },
        },
      },
    ],
  }
  const report = analyzeWebPortability(snap)
  expect(report.portable).toBe(true)
  expect(report.nonPortable).toEqual([])
})

test('analyzeWebPortability flags a desktop local path and names its track', () => {
  const snap = {
    tracks: [
      {
        trackId: 'local-bam',
        name: 'My local alignments',
        adapter: {
          bamLocation: {
            locationType: 'LocalPathLocation',
            localPath: '/home/user/data/a.bam',
          },
          index: {
            indexType: 'BAI',
            location: {
              locationType: 'LocalPathLocation',
              localPath: '/home/user/data/a.bam.bai',
            },
          },
        },
      },
    ],
  }
  const report = analyzeWebPortability(snap)
  expect(report.portable).toBe(false)
  expect(report.nonPortable).toEqual([
    {
      locationType: 'LocalPathLocation',
      name: '/home/user/data/a.bam',
      trackId: 'local-bam',
      trackName: 'My local alignments',
    },
    {
      locationType: 'LocalPathLocation',
      name: '/home/user/data/a.bam.bai',
      trackId: 'local-bam',
      trackName: 'My local alignments',
    },
  ])
})

test('planWebExport reuses the hosted base, carrying only user-added tracks', () => {
  const hubTrack = { trackId: 'hub-track', name: 'Hub track' }
  const userTrack = { trackId: 'user-track', name: 'My track' }
  const plan = planWebExport(
    {
      assemblies: [{ name: 'hg38' }],
      tracks: [hubTrack, userTrack],
      configuration: {
        sourceConfigUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      },
      defaultSession: { name: 'session', views: [] },
    },
    { assemblies: [{ name: 'hg38' }], tracks: [hubTrack] },
  )
  expect(plan.strategy).toBe('hostedConfigBase')
  expect(plan.configUrl).toBe('https://jbrowse.org/ucsc/hg38/config.json')
  expect(plan.session.sessionTracks).toEqual([userTrack])
  expect(plan.session).not.toHaveProperty('sessionAssemblies')
  // an unedited hub track ships nothing — no delta, resolves from the base
  expect(plan.session).not.toHaveProperty('trackConfigDeltas')
})

test('planWebExport ships an edited hub track as a trackConfigDeltas entry', () => {
  const base = { trackId: 'hub-track', name: 'Hub track', color: 'red' }
  const edited = { trackId: 'hub-track', name: 'Hub track', color: 'blue' }
  const plan = planWebExport(
    {
      assemblies: [{ name: 'hg38' }],
      tracks: [edited],
      configuration: {
        sourceConfigUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      },
      defaultSession: { name: 'session', views: [] },
    },
    { assemblies: [{ name: 'hg38' }], tracks: [base] },
  )
  expect(plan.strategy).toBe('hostedConfigBase')
  // the edit rides along as a minimal delta, not a full sessionTracks shadow
  expect(plan.session.sessionTracks).toEqual([])
  expect(plan.session.trackConfigDeltas).toEqual({
    'hub-track': { trackId: 'hub-track', color: 'blue' },
  })
})

test('planWebExport preserves a prior trackConfigDeltas entry alongside an edit', () => {
  const base = { trackId: 'hub-track', name: 'Hub track', color: 'red' }
  const edited = { trackId: 'hub-track', name: 'Hub track', color: 'blue' }
  const plan = planWebExport(
    {
      assemblies: [{ name: 'hg38' }],
      tracks: [edited],
      configuration: {
        sourceConfigUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      },
      defaultSession: {
        name: 'session',
        views: [],
        trackConfigDeltas: { other: { trackId: 'other', height: 200 } },
      },
    },
    { assemblies: [{ name: 'hg38' }], tracks: [base] },
  )
  expect(plan.session.trackConfigDeltas).toEqual({
    other: { trackId: 'other', height: 200 },
    'hub-track': { trackId: 'hub-track', color: 'blue' },
  })
})

test('planWebExport dedupes a track carried by both prior session and snapshot', () => {
  const prior = { trackId: 'user-track', name: 'Old' }
  const current = { trackId: 'user-track', name: 'New' }
  const plan = planWebExport({
    assemblies: [{ name: 'hg38' }],
    tracks: [current],
    defaultSession: { name: 'session', views: [], sessionTracks: [prior] },
  })
  // self-contained (no base): a shared trackId must ship once, snapshot wins,
  // or it collides as an MST identifier on load
  expect(plan.strategy).toBe('selfContained')
  expect(plan.session.sessionTracks).toEqual([current])
})

test('planWebExport falls back to self-contained without a source config', () => {
  const t1 = { trackId: 't1', name: 'remote' }
  const plan = planWebExport({
    assemblies: [{ name: 'mine' }],
    tracks: [t1],
    defaultSession: { name: 'session' },
  })
  expect(plan.strategy).toBe('selfContained')
  expect(plan.configUrl).toBeUndefined()
  expect(plan.session.sessionAssemblies).toEqual([{ name: 'mine' }])
  expect(plan.session.sessionTracks).toEqual([t1])
})

test('planWebExport self-contained keeps prior session assemblies alongside config assemblies', () => {
  const sessionAsm = { name: 'sessionAsm' }
  const plan = planWebExport({
    assemblies: [{ name: 'configAsm' }],
    tracks: [],
    defaultSession: { name: 'session', sessionAssemblies: [sessionAsm] },
  })
  expect(plan.strategy).toBe('selfContained')
  expect(plan.session.sessionAssemblies).toEqual([
    sessionAsm,
    { name: 'configAsm' },
  ])
})

test('planWebExport falls back to self-contained when an assembly is not in the base', () => {
  const plan = planWebExport(
    {
      assemblies: [{ name: 'hg38' }, { name: 'myCustomAsm' }],
      tracks: [],
      configuration: {
        sourceConfigUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      },
      defaultSession: { name: 'session' },
    },
    { assemblies: [{ name: 'hg38' }], tracks: [] },
  )
  expect(plan.strategy).toBe('selfContained')
})

test('planWebExport drops a local config track and names it', () => {
  const plan = planWebExport({
    assemblies: [{ name: 'mine' }],
    tracks: [
      {
        trackId: 'local',
        name: 'Local track',
        adapter: {
          bamLocation: {
            locationType: 'LocalPathLocation',
            localPath: '/data/a.bam',
          },
        },
      },
    ],
    defaultSession: { name: 'session' },
  })
  // the local track is reported, then dropped from the exported session
  expect(plan.droppedTracks).toEqual(['Local track'])
  expect(plan.session.sessionTracks).toEqual([])
})

test('planWebExport drops a local session track but keeps a remote one', () => {
  const remote = { trackId: 'remote', name: 'Remote track' }
  const plan = planWebExport({
    assemblies: [{ name: 'mine' }],
    tracks: [],
    defaultSession: {
      name: 'session',
      sessionTracks: [
        remote,
        {
          trackId: 'local',
          name: 'Local track',
          adapter: {
            bamLocation: {
              locationType: 'LocalPathLocation',
              localPath: '/data/a.bam',
            },
          },
        },
      ],
    },
  })
  expect(plan.session.sessionTracks).toEqual([remote])
  expect(plan.droppedTracks).toEqual(['Local track'])
})

// An assembly's sequence config carries a trackId, so its local file surfaces
// in the portability report tagged with that trackId — but it isn't a droppable
// track. It must be reported as a blocking file (the session can't shed the
// assembly), NOT as a dropped track, and the assembly still ships.
test('planWebExport classifies a local assembly sequence as a blocking file, not a dropped track', () => {
  const plan = planWebExport({
    assemblies: [
      {
        name: 'myasm',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'myasm-ReferenceSequenceTrack',
          adapter: {
            type: 'IndexedFastaAdapter',
            fastaLocation: {
              locationType: 'LocalPathLocation',
              localPath: '/home/me/genome.fa',
            },
            faiLocation: {
              locationType: 'LocalPathLocation',
              localPath: '/home/me/genome.fa.fai',
            },
          },
        },
      },
    ],
    tracks: [],
    defaultSession: { name: 'session' },
  })
  expect(plan.strategy).toBe('selfContained')
  // not misreported as a dropped track
  expect(plan.droppedTracks).toEqual([])
  // reported as blocking, with the local file names
  expect(plan.blockingFiles).toEqual([
    '/home/me/genome.fa',
    '/home/me/genome.fa.fai',
  ])
  // the assembly still ships (dropping it would destroy the whole session)
  expect(plan.session.sessionAssemblies).toHaveLength(1)
})

// A remote-sequence assembly alongside a local user track: the track is dropped,
// the assembly ships, and nothing is reported as blocking.
test('planWebExport keeps a remote assembly and drops only the local user track', () => {
  const plan = planWebExport({
    assemblies: [
      {
        name: 'hg38',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'hg38-ReferenceSequenceTrack',
          adapter: {
            type: 'TwoBitAdapter',
            twoBitLocation: {
              locationType: 'UriLocation',
              uri: 'https://example.com/hg38.2bit',
            },
          },
        },
      },
    ],
    tracks: [
      {
        trackId: 'local',
        name: 'Local track',
        adapter: {
          bamLocation: {
            locationType: 'LocalPathLocation',
            localPath: '/data/a.bam',
          },
        },
      },
    ],
    defaultSession: { name: 'session' },
  })
  expect(plan.droppedTracks).toEqual(['Local track'])
  expect(plan.blockingFiles).toEqual([])
  expect(plan.session.sessionTracks).toEqual([])
  expect(plan.session.sessionAssemblies).toHaveLength(1)
})

// A hosted-base export leaves the config's assemblies behind but still ships
// the prior session's `sessionAssemblies` verbatim, so a local file in one of
// those is neither droppable (dropping the assembly kills the session) nor
// covered by the base — it has to be reported as blocking.
test('planWebExport reports a local session assembly as blocking under a hosted base', () => {
  const plan = planWebExport(
    {
      assemblies: [{ name: 'hg38' }],
      tracks: [],
      configuration: {
        sourceConfigUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      },
      defaultSession: {
        name: 'session',
        sessionAssemblies: [
          {
            name: 'myasm',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'myasm-ReferenceSequenceTrack',
              adapter: {
                type: 'IndexedFastaAdapter',
                fastaLocation: {
                  locationType: 'LocalPathLocation',
                  localPath: '/home/me/genome.fa',
                },
              },
            },
          },
        ],
      },
    },
    { assemblies: [{ name: 'hg38' }], tracks: [] },
  )
  expect(plan.strategy).toBe('hostedConfigBase')
  expect(plan.droppedTracks).toEqual([])
  expect(plan.blockingFiles).toEqual(['/home/me/genome.fa'])
})

// The mirror image: the config's own assemblies do NOT ship under a hosted
// base, so their local files are the base's problem and must not be reported.
test('planWebExport does not report a local config assembly under a hosted base', () => {
  const plan = planWebExport(
    {
      assemblies: [
        {
          name: 'hg38',
          refNameAliases: {
            adapter: {
              location: {
                locationType: 'LocalPathLocation',
                localPath: '/home/me/aliases.txt',
              },
            },
          },
        },
      ],
      tracks: [],
      configuration: {
        sourceConfigUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      },
      defaultSession: { name: 'session' },
    },
    { assemblies: [{ name: 'hg38' }], tracks: [] },
  )
  expect(plan.strategy).toBe('hostedConfigBase')
  expect(plan.droppedTracks).toEqual([])
  expect(plan.blockingFiles).toEqual([])
})

// An open connection track's config ships in `connectionTrackConfigs`, which the
// droppable-track filter never touches, so a local one blocks rather than
// silently going along unreported.
test('planWebExport reports a local connection track config as blocking', () => {
  const plan = planWebExport({
    assemblies: [{ name: 'hg38' }],
    tracks: [],
    defaultSession: {
      name: 'session',
      connectionTrackConfigs: {
        'conn-track': {
          connectionId: 'conn',
          config: {
            trackId: 'conn-track',
            name: 'Connection track',
            adapter: {
              bamLocation: {
                locationType: 'LocalPathLocation',
                localPath: '/data/conn.bam',
              },
            },
          },
        },
      },
    },
  })
  expect(plan.blockingFiles).toEqual(['/data/conn.bam'])
  // and not also announced as a track that was left out — nothing dropped it
  expect(plan.droppedTracks).toEqual([])
})

test('planWebExport carries plugins into sessionPlugins when self-contained', () => {
  const plan = planWebExport({
    assemblies: [{ name: 'mine' }],
    tracks: [],
    plugins: [{ name: 'MyPlugin', umdUrl: 'https://example.com/my.js' }],
    defaultSession: { name: 'session' },
  })
  expect(plan.session.sessionPlugins).toEqual([
    { name: 'MyPlugin', umdUrl: 'https://example.com/my.js' },
  ])
})

test('planWebExport carries only the plugins a hosted base does not declare', () => {
  const shared = { name: 'Shared', umdUrl: 'https://example.com/shared.js' }
  const extra = { name: 'Extra', umdUrl: 'https://example.com/extra.js' }
  const plan = planWebExport(
    {
      assemblies: [{ name: 'hg38' }],
      tracks: [],
      plugins: [shared, extra],
      configuration: {
        sourceConfigUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      },
      defaultSession: { name: 'session' },
    },
    { assemblies: [{ name: 'hg38' }], tracks: [], plugins: [shared] },
  )
  expect(plan.strategy).toBe('hostedConfigBase')
  // the base's own plugins[] is loaded by jbrowse-web from ?config=, so shipping
  // it again would install the same plugin twice
  expect(plan.session.sessionPlugins).toEqual([extra])
})

test('planWebExport leaves sessionPlugins out entirely when there are none', () => {
  const plan = planWebExport({
    assemblies: [{ name: 'mine' }],
    tracks: [],
    plugins: [],
    defaultSession: { name: 'session' },
  })
  expect(plan.session).not.toHaveProperty('sessionPlugins')
  expect(plan.session).not.toHaveProperty('sessionConnections')
})

// Desktop keeps connections in `jbrowse.connections`, which the export never
// ships — so without sessionConnections a track hub is simply gone on the web.
test('planWebExport carries connections into sessionConnections', () => {
  const hub = {
    type: 'UCSCTrackHubConnection',
    connectionId: 'hub1',
    hubTxtLocation: { uri: 'https://example.com/hub.txt' },
  }
  const plan = planWebExport({
    assemblies: [{ name: 'mine' }],
    tracks: [],
    connections: [hub],
    defaultSession: { name: 'session' },
  })
  expect(plan.session.sessionConnections).toEqual([hub])
})

test('planWebExport carries only the connections a hosted base does not declare', () => {
  const shared = { connectionId: 'hub1', type: 'UCSCTrackHubConnection' }
  const extra = { connectionId: 'hub2', type: 'UCSCTrackHubConnection' }
  const plan = planWebExport(
    {
      assemblies: [{ name: 'hg38' }],
      tracks: [],
      connections: [shared, extra],
      configuration: {
        sourceConfigUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      },
      defaultSession: { name: 'session' },
    },
    { assemblies: [{ name: 'hg38' }], tracks: [], connections: [shared] },
  )
  expect(plan.strategy).toBe('hostedConfigBase')
  // the recipient concatenates jbrowse.connections with sessionConnections, so
  // shipping one the base already has lists the same hub twice
  expect(plan.session.sessionConnections).toEqual([extra])
})

// sessionAssemblies and the config's assemblies land in ONE namespace on the
// recipient, and the duplicate-name guard there is on the add path, which a
// deserialized snapshot never takes. A colliding name doesn't get rejected, it
// makes every assembly reference ambiguous and takes the session down.
test('planWebExport drops a session assembly the hosted base already provides', () => {
  const plan = planWebExport(
    {
      assemblies: [{ name: 'hg38' }],
      tracks: [],
      configuration: {
        sourceConfigUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      },
      defaultSession: {
        name: 'session',
        sessionAssemblies: [{ name: 'hg38' }, { name: 'mine' }],
      },
    },
    { assemblies: [{ name: 'hg38' }], tracks: [] },
  )
  expect(plan.strategy).toBe('hostedConfigBase')
  expect(plan.session.sessionAssemblies).toEqual([{ name: 'mine' }])
})

test('planWebExport targets the public jbrowse-web by default', () => {
  const plan = planWebExport({ assemblies: [], tracks: [] })
  expect(plan.webBaseUrl).toBe('https://jbrowse.org/code/jb2/latest/')
  expect(buildWebExportUrl(plan, 'encoded-ABC')).toContain(
    'https://jbrowse.org/code/jb2/latest/',
  )
})

test('planWebExport honors a config webExportUrl', () => {
  const plan = planWebExport({
    assemblies: [],
    tracks: [],
    configuration: { webExportUrl: 'https://inst.example/jbrowse/' },
  })
  expect(plan.webBaseUrl).toBe('https://inst.example/jbrowse/')
  const parsed = new URL(buildWebExportUrl(plan, 'encoded-ABC'))
  expect(parsed.origin + parsed.pathname).toBe('https://inst.example/jbrowse/')
})

// A typo in a config slot must not be able to make exporting impossible
test('planWebExport falls back to the default for an unusable webExportUrl', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  expect(
    planWebExport({
      configuration: { webExportUrl: 'not a url' },
    }).webBaseUrl,
  ).toBe('https://jbrowse.org/code/jb2/latest/')
  // a url that parses but isn't something a browser should be sent to
  expect(
    planWebExport({
      configuration: { webExportUrl: 'file:///home/me/jbrowse/' },
    }).webBaseUrl,
  ).toBe('https://jbrowse.org/code/jb2/latest/')
  errorSpy.mockRestore()
})

test('buildWebExportUrl puts an encoded- long link in the hash, keeping config', () => {
  const url = buildWebExportUrl(
    {
      configUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      webBaseUrl: 'https://jbrowse.org/code/jb2/latest/',
    },
    'encoded-ABC',
  )
  const parsed = new URL(url)
  expect(parsed.origin + parsed.pathname).toBe(
    'https://jbrowse.org/code/jb2/latest/',
  )
  // inline session lives in the hash (never sent to the server, avoids HTTP 414)
  expect(parsed.search).toBe('')
  const hashParams = new URLSearchParams(parsed.hash.slice(1))
  expect(hashParams.get('config')).toBe(
    'https://jbrowse.org/ucsc/hg38/config.json',
  )
  expect(hashParams.get('session')).toBe('encoded-ABC')
})

test('buildWebExportUrl puts a self-contained encoded- session in the hash', () => {
  const url = buildWebExportUrl(
    { webBaseUrl: 'https://jbrowse.org/code/jb2/latest/' },
    'encoded-XYZ',
  )
  const parsed = new URL(url)
  expect(parsed.search).toBe('')
  const hashParams = new URLSearchParams(parsed.hash.slice(1))
  expect(hashParams.get('config')).toBe('none')
  expect(hashParams.get('session')).toBe('encoded-XYZ')
})

test('buildWebExportUrl adds the password param for a short share link', () => {
  const url = buildWebExportUrl(
    { webBaseUrl: 'https://jbrowse.org/code/jb2/latest/' },
    'share-abc123',
    { password: 'sekret' },
  )
  const parsed = new URL(url)
  expect(parsed.searchParams.get('session')).toBe('share-abc123')
  expect(parsed.searchParams.get('password')).toBe('sekret')
})

// The link points at `latest` and diffs a hosted base config that is fetched
// fresh on both ends, so nothing else in it is pinned. What produced it is the
// one thing the producer can record.
test('buildWebExportUrl stamps what produced the link, in whichever half carries the session', () => {
  const plan = { webBaseUrl: 'https://jbrowse.org/code/jb2/latest/' }
  const stamp = { exportedFrom: 'jbrowse-desktop@3.6.4' }
  const inline = new URL(buildWebExportUrl(plan, 'encoded-ABC', stamp))
  expect(new URLSearchParams(inline.hash.slice(1)).get('exportedFrom')).toBe(
    'jbrowse-desktop@3.6.4',
  )
  const short = new URL(buildWebExportUrl(plan, 'share-abc123', stamp))
  expect(short.searchParams.get('exportedFrom')).toBe('jbrowse-desktop@3.6.4')
  // and an unstamped link stays exactly as it was
  expect(buildWebExportUrl(plan, 'encoded-ABC')).not.toContain('exportedFrom')
})

test('analyzeWebPortability flags blob and file-handle locations by name', () => {
  const snap = {
    tracks: [
      {
        trackId: 'blob-track',
        name: 'Dropped file',
        adapter: {
          bamLocation: {
            locationType: 'BlobLocation',
            name: 'dropped.bam',
            blobId: 'b123',
          },
        },
      },
      {
        trackId: 'handle-track',
        name: 'Picked file',
        adapter: {
          bamLocation: {
            locationType: 'FileHandleLocation',
            name: 'picked.bam',
            handleId: 'fh123',
          },
        },
      },
    ],
  }
  const report = analyzeWebPortability(snap)
  expect(report.nonPortable.map(l => [l.locationType, l.name])).toEqual([
    ['BlobLocation', 'dropped.bam'],
    ['FileHandleLocation', 'picked.bam'],
  ])
})

// Indexing a remote track on desktop writes the Trix triple to local disk, which
// used to make the whole track non-portable and drop it — reported to the user
// as a track that "references local files", when the data file was a url the
// recipient could open perfectly well.
test('planWebExport keeps a remote track whose text-search index is local', () => {
  const plan = planWebExport({
    assemblies: [],
    tracks: [
      {
        trackId: 'remote-gff',
        name: 'Genes',
        adapter: {
          gffLocation: {
            uri: 'https://example.com/genes.gff.gz',
            locationType: 'UriLocation',
          },
        },
        textSearching: {
          indexingAttributes: ['Name', 'ID'],
          textSearchAdapter: {
            type: 'TrixTextSearchAdapter',
            textSearchAdapterId: 'remote-gff-index',
            ixFilePath: {
              localPath: '/home/me/trix/remote-gff.ix',
              locationType: 'LocalPathLocation',
            },
          },
        },
      },
    ],
  })
  expect(plan.droppedTracks).toEqual([])
  expect(plan.blockingFiles).toEqual([])
  expect(plan.droppedTextIndexes).toEqual(['Genes'])
  const [shipped] = plan.session.sessionTracks as Record<string, unknown>[]
  expect(shipped).not.toHaveProperty('textSearching')
  expect(shipped!.adapter).toBeDefined()
})

// A track whose DATA is local is still dropped whole — the index rule only
// applies to the search index.
test('planWebExport still drops a track whose data file is local', () => {
  const plan = planWebExport({
    assemblies: [],
    tracks: [
      {
        trackId: 'local-bam',
        name: 'Local alignments',
        adapter: {
          bamLocation: {
            localPath: '/home/me/a.bam',
            locationType: 'LocalPathLocation',
          },
        },
        textSearching: {
          textSearchAdapter: {
            ixFilePath: {
              localPath: '/home/me/trix/local-bam.ix',
              locationType: 'LocalPathLocation',
            },
          },
        },
      },
    ],
  })
  expect(plan.droppedTracks).toEqual(['Local alignments'])
  expect(plan.session.sessionTracks).toEqual([])
})

// Under a hosted base the omission is also the right delta: a delta records adds
// and changes but never a deletion, so leaving the local index out lets the
// base's own index resolve instead of pinning the recipient to a path on the
// sender's disk.
test('planWebExport does not ship a local text index as a hub track edit', () => {
  const base = {
    trackId: 'hub-track',
    name: 'Hub track',
    textSearching: {
      textSearchAdapter: {
        ixFilePath: {
          uri: 'https://hub.example/hub-track.ix',
          locationType: 'UriLocation',
        },
      },
    },
  }
  const plan = planWebExport(
    {
      assemblies: [{ name: 'hg38' }],
      tracks: [
        {
          ...base,
          textSearching: {
            textSearchAdapter: {
              ixFilePath: {
                localPath: '/home/me/trix/hub-track.ix',
                locationType: 'LocalPathLocation',
              },
            },
          },
        },
      ],
      configuration: { sourceConfigUrl: 'https://hub.example/config.json' },
    },
    { assemblies: [{ name: 'hg38' }], tracks: [base] },
  )
  expect(plan.strategy).toBe('hostedConfigBase')
  expect(plan.session).not.toHaveProperty('trackConfigDeltas')
  expect(plan.droppedTextIndexes).toEqual(['Hub track'])
})

// Three self-contained plans that used to render the same sentence. Only the
// unreachable one is something the sender can act on, and it is the one that
// silently turns a 200-character link into an unopenable one.
test('planWebExport says why a self-contained export is self-contained', () => {
  expect(planWebExport({ assemblies: [] }).selfContainedReason).toBe(
    'noSourceConfig',
  )
  expect(
    planWebExport({
      assemblies: [{ name: 'hg38' }],
      configuration: { sourceConfigUrl: 'https://hub.example/config.json' },
    }).selfContainedReason,
  ).toBe('baseUnreachable')
  expect(
    planWebExport(
      {
        assemblies: [{ name: 'hg19' }],
        configuration: { sourceConfigUrl: 'https://hub.example/config.json' },
      },
      { assemblies: [{ name: 'hg38' }] },
    ).selfContainedReason,
  ).toBe('assembliesNotInBase')
  expect(
    planWebExport(
      {
        assemblies: [{ name: 'hg38' }],
        configuration: { sourceConfigUrl: 'https://hub.example/config.json' },
      },
      { assemblies: [{ name: 'hg38' }] },
    ).selfContainedReason,
  ).toBeUndefined()
})

// coveredByBase matches on name alone and nothing ships an assembly edit, so the
// hub's original silently wins. The sender at least gets told which ones.
test('planWebExport reports an edited assembly the hosted base takes back', () => {
  const baseAssembly = {
    name: 'hg38',
    sequence: {
      trackId: 'hg38-ReferenceSequenceTrack',
      type: 'ReferenceSequenceTrack',
    },
  }
  const plan = planWebExport(
    {
      assemblies: [
        {
          ...baseAssembly,
          refNameAliases: {
            adapter: {
              type: 'RefNameAliasAdapter',
              location: {
                uri: 'https://example.com/aliases.txt',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      configuration: { sourceConfigUrl: 'https://hub.example/config.json' },
    },
    { assemblies: [baseAssembly] },
  )
  expect(plan.strategy).toBe('hostedConfigBase')
  expect(plan.revertedAssemblies).toEqual(['hg38'])
})

test('planWebExport reports a session assembly the hosted base shadows', () => {
  const assembly = { name: 'hg38' }
  const plan = planWebExport(
    {
      assemblies: [assembly],
      configuration: { sourceConfigUrl: 'https://hub.example/config.json' },
      defaultSession: { sessionAssemblies: [{ name: 'hg38' }] },
    },
    { assemblies: [assembly] },
  )
  expect(plan.session.sessionAssemblies).toEqual([])
  expect(plan.revertedAssemblies).toEqual(['hg38'])
})

test('planWebExport reports no reverted assembly when nothing was edited', () => {
  const assembly = { name: 'hg38', sequence: { trackId: 'hg38-seq' } }
  expect(
    planWebExport(
      {
        assemblies: [assembly],
        configuration: { sourceConfigUrl: 'https://hub.example/config.json' },
      },
      { assemblies: [assembly] },
    ).revertedAssemblies,
  ).toEqual([])
})

// Internet accounts live in the root config alone — no session carries one — so
// a shipped track naming an account the recipient has no config for reaches them
// with nothing to authenticate against.
test('planWebExport reports an internet account the recipient will not have', () => {
  const track = {
    trackId: 'private',
    name: 'Private data',
    adapter: {
      bamLocation: {
        uri: 'https://private.example/a.bam',
        locationType: 'UriLocation',
        internetAccountId: 'dropbox1',
      },
    },
  }
  expect(
    planWebExport({ assemblies: [], tracks: [track] }).unavailableAccounts,
  ).toEqual(['dropbox1'])
  // the hosted base declares it, so the recipient builds it from the config
  expect(
    planWebExport(
      {
        assemblies: [{ name: 'hg38' }],
        tracks: [track],
        configuration: { sourceConfigUrl: 'https://hub.example/config.json' },
      },
      {
        assemblies: [{ name: 'hg38' }],
        internetAccounts: [{ internetAccountId: 'dropbox1' }],
      },
    ).unavailableAccounts,
  ).toEqual([])
})

// The webExportUrl slot names a deployment, and the easiest way to fill it is to
// paste a jbrowse-web address — which carries the pasting user's own params.
// jbrowse-web reads the hash whenever it holds any, so a leftover one opened the
// sender's session and ignored the export entirely.
test('planWebExport strips params from a pasted webExportUrl', () => {
  const plan = planWebExport({
    configuration: {
      webExportUrl:
        'https://inst.example/jb2/?trackId=x#config=hub.json&session=local-abc',
    },
  })
  expect(plan.webBaseUrl).toBe('https://inst.example/jb2/')
  const url = new URL(buildWebExportUrl(plan, 'share-abc123'))
  expect(url.hash).toBe('')
  expect(url.searchParams.get('session')).toBe('share-abc123')
})
