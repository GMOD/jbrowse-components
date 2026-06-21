import {
  getRoot,
  getType,
  resolveIdentifier,
  types,
  unprotect,
} from '@jbrowse/mobx-state-tree'
import { runInAction } from 'mobx'

import {
  addRelativeUris,
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

test('filterSessionInPlace drops a config-bearing element whose config is dangling', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const container = ConfigBearingContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: [
      { id: 'keep', configuration: 'a' },
      { id: 'drop', configuration: 'missing' },
    ],
  })
  unprotect(container)
  runInAction(() => {
    filterSessionInPlace(container, getType(container))
  })
  expect(container.children.map(c => c.id)).toEqual(['keep'])
  errorSpy.mockRestore()
})

test('addRelativeUris stamps baseUri next to a uri key', () => {
  const config: Record<string, unknown> = { uri: 'data.bam' }
  addRelativeUris(config, new URL('https://example.com/config/'))
  expect(config.baseUri).toBe('https://example.com/config/')
})

test('addRelativeUris recurses into nested objects and arrays', () => {
  const config: Record<string, unknown> = {
    adapter: { uri: 'data.bam' },
    tracks: [{ uri: 'a.bam' }, { uri: 'b.bam' }],
  }
  addRelativeUris(config, new URL('https://example.com/'))
  expect((config.adapter as Record<string, unknown>).baseUri).toBe(
    'https://example.com/',
  )
  expect(
    (config.tracks as Record<string, unknown>[]).map(t => t.baseUri),
  ).toEqual(['https://example.com/', 'https://example.com/'])
})

// preserve-existing is the behavior that differed from the (now-deleted)
// data-management copy, which overwrote unconditionally
test('addRelativeUris preserves an existing baseUri', () => {
  const config: Record<string, unknown> = {
    uri: 'data.bam',
    baseUri: 'https://other.com/',
  }
  addRelativeUris(config, new URL('https://example.com/config/'))
  expect(config.baseUri).toBe('https://other.com/')
})

test('addRelativeUris tolerates null', () => {
  expect(() => {
    addRelativeUris(null, new URL('https://example.com/'))
  }).not.toThrow()
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

test('planWebExport carries the portability report through', () => {
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
      } as { trackId: string },
    ],
    defaultSession: { name: 'session' },
  })
  expect(plan.report.portable).toBe(false)
  expect(plan.report.nonPortable[0]?.trackId).toBe('local')
})

test('buildWebExportUrl points config at the hosted base and session at encoded-', () => {
  const url = buildWebExportUrl(
    {
      strategy: 'hostedConfigBase',
      configUrl: 'https://jbrowse.org/ucsc/hg38/config.json',
      session: {},
      report: { nonPortable: [], portable: true },
    },
    'encoded-ABC',
  )
  const parsed = new URL(url)
  expect(parsed.origin + parsed.pathname).toBe(
    'https://jbrowse.org/code/jb2/latest/',
  )
  expect(parsed.searchParams.get('config')).toBe(
    'https://jbrowse.org/ucsc/hg38/config.json',
  )
  expect(parsed.searchParams.get('session')).toBe('encoded-ABC')
})

test('buildWebExportUrl uses config=none for a self-contained session', () => {
  const url = buildWebExportUrl(
    {
      strategy: 'selfContained',
      session: {},
      report: { nonPortable: [], portable: true },
    },
    'encoded-XYZ',
  )
  const parsed = new URL(url)
  expect(parsed.searchParams.get('config')).toBe('none')
  expect(parsed.searchParams.get('session')).toBe('encoded-XYZ')
})

test('buildWebExportUrl adds the password param for a short share link', () => {
  const url = buildWebExportUrl(
    {
      strategy: 'selfContained',
      session: {},
      report: { nonPortable: [], portable: true },
    },
    'share-abc123',
    { password: 'sekret' },
  )
  const parsed = new URL(url)
  expect(parsed.searchParams.get('session')).toBe('share-abc123')
  expect(parsed.searchParams.get('password')).toBe('sekret')
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
