import PluginManager from '@jbrowse/core/PluginManager'
import { getConf } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import rootModelFactory from './rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// A v4 session or share link, loaded the way a product loads one, and read
// back off the live display: the migrations are snapshot rewrites, so a test
// of the rewrite alone passes while the display they aim at never sees it.

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'bam',
    name: 'bam',
    assemblyNames: ['volvox'],
    adapter: { type: 'BamAdapter', uri: 'a.bam' },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'bam_v4_config',
    name: 'bam_v4_config',
    assemblyNames: ['volvox'],
    adapter: { type: 'BamAdapter', uri: 'a.bam' },
    displays: [
      {
        type: 'LinearPileupDisplay',
        displayId: 'bam_v4_config-LinearPileupDisplay',
      },
    ],
  },
  {
    type: 'MultiQuantitativeTrack',
    trackId: 'multi',
    name: 'multi',
    assemblyNames: ['volvox'],
    adapter: { type: 'MultiWiggleAdapter', bigWigs: ['a.bw', 'b.bw'] },
  },
  // what jb2hubs writes for a UCSC overlaid multiWig, and keeps writing for
  // older releases
  {
    type: 'MultiQuantitativeTrack',
    trackId: 'layered',
    name: 'layered',
    assemblyNames: ['volvox'],
    adapter: { type: 'MultiWiggleAdapter', bigWigs: ['a.bw', 'b.bw'] },
    displays: [
      { type: 'MultiLinearWiggleDisplay', defaultRendering: 'multixyplot' },
    ],
  },
  {
    type: 'QuantitativeTrack',
    trackId: 'bw',
    name: 'bw',
    assemblyNames: ['volvox'],
    adapter: { type: 'BigWigAdapter', uri: 'a.bw' },
  },
  {
    type: 'VariantTrack',
    trackId: 'vcf',
    name: 'vcf',
    assemblyNames: ['volvox'],
    adapter: { type: 'VcfTabixAdapter', uri: 'a.vcf.gz' },
  },
]

function setup() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'FromConfigSequenceAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'a',
                  start: 0,
                  end: 1000,
                  seq: 'A'.repeat(1000),
                },
              ],
            },
          },
        },
      ],
      tracks,
    },
  })
  return { root, pluginManager }
}

function v4Session(trackType: string, trackId: string, display: object) {
  return {
    name: 'v4',
    views: [
      {
        id: 'lgv',
        type: 'LinearGenomeView',
        offsetPx: 0,
        bpPerPx: 1,
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
        ],
        tracks: [
          {
            id: 't1',
            type: trackType,
            configuration: trackId,
            displays: [{ id: 'd1', ...display }],
          },
        ],
      },
    ],
  }
}

async function load(snap: Record<string, unknown>) {
  const { root, pluginManager } = setup()
  await pluginManager.preloadSessionTypes(snap)
  root.setSession(snap)
  const session = root.session
  return {
    display: session.views[0].tracks[0]?.displays[0],
    notifications: (session.snackbarMessages as { message: string }[]).map(
      n => n.message,
    ),
  }
}

test('a v4 pileup display on a config.json track keeps its settings', async () => {
  const { display } = await load(
    v4Session('AlignmentsTrack', 'bam', {
      type: 'LinearPileupDisplay',
      configuration: 'bam-LinearPileupDisplay',
      colorBySetting: { type: 'strand' },
      heightPreConfig: 333,
    }),
  )
  expect(display.type).toBe('LinearAlignmentsDisplay')
  expect(getConf(display, ['color', 'field'])).toBe('strand')
  expect(getConf(display, 'showCoverage')).toBe(false)
  expect(display.height).toBe(333)
})

test('a v4 pileup display keeps its settings on a config.json that still spells the old type', async () => {
  const { display } = await load(
    v4Session('AlignmentsTrack', 'bam_v4_config', {
      type: 'LinearPileupDisplay',
      configuration: 'bam_v4_config-LinearPileupDisplay',
      colorBySetting: { type: 'strand' },
    }),
  )
  expect(getConf(display, ['color', 'field'])).toBe('strand')
  expect(getConf(display, 'showCoverage')).toBe(false)
})

test('a v4 read-arcs display on a config.json track keeps drawing arcs', async () => {
  const { display } = await load(
    v4Session('AlignmentsTrack', 'bam', {
      type: 'LinearReadArcsDisplay',
      configuration: 'bam-LinearReadArcsDisplay',
    }),
  )
  expect(getConf(display, 'readConnections')).toBe('arc')
  expect(getConf(display, 'showPileup')).toBe(false)
  expect(getConf(display, 'showCoverage')).toBe(false)
})

test('a v4 multi-wiggle display opens as rows, in its order and colours', async () => {
  const { display, notifications } = await load(
    v4Session('MultiQuantitativeTrack', 'multi', {
      type: 'MultiLinearWiggleDisplay',
      configuration: 'multi-MultiLinearWiggleDisplay',
      rendererTypeNameState: 'multirowdensity',
      layout: [
        { name: 'b', source: 'b', color: 'red' },
        { name: 'A sample', source: 'a' },
      ],
    }),
  )
  expect(notifications).toEqual([])
  expect(display.type).toBe('LinearWiggleDisplay')
  expect(display.isRowLayout).toBe(true)
  expect(display.renderingType).toBe('density')
  expect(display.rowDomain).toEqual(['b', 'a'])
  expect(display.rowLabels).toEqual({ a: 'A sample' })
  expect(getConf(display, ['rowColor', 'range'])).toEqual(['red'])
})

// A v4 multi-bigwig the user added themselves is a session track, so the entry
// the lifted settings land on still spells the retired type and meets the
// retired-type fold a second time when it hydrates.
test('a v4 multi-wiggle SESSION track opens as rows', async () => {
  const { display } = await load({
    name: 'v4',
    sessionTracks: [
      {
        type: 'MultiQuantitativeTrack',
        trackId: 'st_multi',
        name: 'st_multi',
        assemblyNames: ['volvox'],
        adapter: { type: 'MultiWiggleAdapter', bigWigs: ['a.bw', 'b.bw'] },
        displays: [
          {
            type: 'MultiLinearWiggleDisplay',
            displayId: 'st_multi-MultiLinearWiggleDisplay',
          },
        ],
      },
    ],
    views: [
      {
        id: 'lgv',
        type: 'LinearGenomeView',
        offsetPx: 0,
        bpPerPx: 1,
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
        ],
        tracks: [
          {
            id: 't1',
            type: 'MultiQuantitativeTrack',
            configuration: 'st_multi',
            displays: [
              {
                id: 'd1',
                type: 'MultiLinearWiggleDisplay',
                configuration: 'st_multi-MultiLinearWiggleDisplay',
                rendererTypeNameState: 'multirowxy',
              },
            ],
          },
        ],
      },
    ],
  })
  expect(display.type).toBe('LinearWiggleDisplay')
  expect(display.renderingType).toBe('xyplot')
  expect(display.isRowLayout).toBe(true)
  expect(getConf(display, ['rows', 'field'])).toBe('source')
})

test('a v4 multi-wiggle SESSION track left overlaid stays overlaid', async () => {
  const { display } = await load({
    name: 'v4',
    sessionTracks: [
      {
        type: 'MultiQuantitativeTrack',
        trackId: 'st_multi2',
        name: 'st_multi2',
        assemblyNames: ['volvox'],
        adapter: { type: 'MultiWiggleAdapter', bigWigs: ['a.bw', 'b.bw'] },
        displays: [
          {
            type: 'MultiLinearWiggleDisplay',
            displayId: 'st_multi2-MultiLinearWiggleDisplay',
          },
        ],
      },
    ],
    views: [
      {
        id: 'lgv',
        type: 'LinearGenomeView',
        offsetPx: 0,
        bpPerPx: 1,
        displayedRegions: [
          { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
        ],
        tracks: [
          {
            id: 't1',
            type: 'MultiQuantitativeTrack',
            configuration: 'st_multi2',
            displays: [
              {
                id: 'd1',
                type: 'MultiLinearWiggleDisplay',
                configuration: 'st_multi2-MultiLinearWiggleDisplay',
                rendererTypeNameState: 'xyplot',
              },
            ],
          },
        ],
      },
    ],
  })
  expect(getConf(display, ['rows', 'field'])).toBe('')
  expect(display.isRowLayout).toBe(false)
})

test('a v4 multi-wiggle display left overlaid stays overlaid', async () => {
  const { display } = await load(
    v4Session('MultiQuantitativeTrack', 'multi', {
      type: 'MultiLinearWiggleDisplay',
      configuration: 'multi-MultiLinearWiggleDisplay',
      rendererTypeNameState: 'xyplot',
    }),
  )
  expect(display.isRowLayout).toBe(false)
  expect(display.renderingType).toBe('xyplot')
})

test('a v4 multi-wiggle display on its default opens as rows', async () => {
  const { display } = await load(
    v4Session('MultiQuantitativeTrack', 'multi', {
      type: 'MultiLinearWiggleDisplay',
      configuration: 'multi-MultiLinearWiggleDisplay',
    }),
  )
  expect(display.isRowLayout).toBe(true)
  expect(display.renderingType).toBe('xyplot')
})

// the lifted arrangement names no field, and must not switch the rows off
test('a v4 multi-wiggle display arranged on its default keeps its rows', async () => {
  const { display } = await load(
    v4Session('MultiQuantitativeTrack', 'multi', {
      type: 'MultiLinearWiggleDisplay',
      configuration: 'multi-MultiLinearWiggleDisplay',
      layout: [
        { name: 'b', source: 'b' },
        { name: 'a', source: 'a' },
      ],
      clusterTree: '(b:1,a:1);',
    }),
  )
  expect(display.isRowLayout).toBe(true)
  expect(display.rowDomain).toEqual(['b', 'a'])
  expect(getConf(display, ['rows', 'tree'])).toBe('(b:1,a:1);')
})

test("a hosted config's overlaid multi-wiggle opens overlaid", async () => {
  const { display } = await load(
    v4Session('MultiQuantitativeTrack', 'layered', {
      type: 'LinearWiggleDisplay',
      configuration: 'layered-LinearWiggleDisplay',
    }),
  )
  expect(display.isRowLayout).toBe(false)
  expect(display.renderingType).toBe('xyplot')
})

test('a v4 wiggle display keeps the scale and colours a reader set', async () => {
  const { display } = await load(
    v4Session('QuantitativeTrack', 'bw', {
      type: 'LinearWiggleDisplay',
      configuration: 'bw-LinearWiggleDisplay',
      scale: 'log',
      autoscale: 'localsd',
      constraints: { min: 1 },
      posColor: 'green',
      rendererTypeNameState: 'line',
    }),
  )
  expect(display.renderingType).toBe('line')
  expect(getConf(display, ['scales', 'y', 'type'])).toBe('log')
  expect(getConf(display, ['scales', 'y', 'autoscale'])).toBe('localsd')
  expect(getConf(display, ['scales', 'y', 'domainMin'])).toBe(1)
  expect(getConf(display, ['color', 'range'])).toEqual(['#e01e26', 'green'])
})

test('a v4 clustered multi-sample variant display loads with its order and tree', async () => {
  const { display } = await load(
    v4Session('VariantTrack', 'vcf', {
      type: 'MultiLinearVariantDisplay',
      configuration: 'vcf-MultiLinearVariantDisplay',
      layout: [{ name: 'HG00097', color: '#e41a1c' }, { name: 'HG00096' }],
      clusterTree: '(HG00097:1,HG00096:1);',
      subtreeFilter: ['HG00097'],
    }),
  )
  expect(display.type).toBe('LinearMultiSampleVariantDisplay')
  expect(display.rowDomain).toEqual(['HG00097', 'HG00096'])
  expect(getConf(display, ['rows', 'tree'])).toBe('(HG00097:1,HG00096:1);')
  expect(getConf(display, ['rows', 'kept'])).toEqual(['HG00097'])
  expect(getConf(display, ['rowColor', 'domain'])).toEqual([])
})

// `scatterPointSize` is a v5-beta spelling, not a v4 one — v4 had no
// configurable scatter point diameter at all.
test("a beta session track's scatterPointSize is the wiggle display's size", async () => {
  const { display } = await load({
    ...v4Session('QuantitativeTrack', 'bw_session', {
      type: 'LinearWiggleDisplay',
      configuration: 'bw_session-LinearWiggleDisplay',
    }),
    sessionTracks: [
      {
        type: 'QuantitativeTrack',
        trackId: 'bw_session',
        name: 'bw_session',
        assemblyNames: ['volvox'],
        adapter: { type: 'BigWigAdapter', uri: 'a.bw' },
        displays: [
          {
            type: 'LinearWiggleDisplay',
            displayId: 'bw_session-LinearWiggleDisplay',
            scatterPointSize: 5,
          },
        ],
      },
    ],
  })
  expect(getConf(display, 'size')).toBe(5)
})

function wiggleSlots(display: Parameters<typeof getConf>[0]) {
  return {
    rows: getConf(display, ['rows', 'field']),
    height: getConf(display, 'height'),
    summaryScoreMode: getConf(display, 'summaryScoreMode'),
  }
}

async function reload({ root, pluginManager }: ReturnType<typeof setup>) {
  const snap = getSnapshot(root.session)
  await pluginManager.preloadSessionTypes(snap)
  root.setSession(snap)
  return root.session.views[0].tracks[0]?.displays[0]
}

test.each([
  [{}, { rows: 'source', height: 200, summaryScoreMode: 'avg' }],
  [
    { rows: '', height: 100, summaryScoreMode: 'whiskers' },
    { rows: '', height: 100, summaryScoreMode: 'whiskers' },
  ],
])(
  'a multi-wiggle session track spelling %j reads %j, before and after a reload',
  async (spelled, expected) => {
    const harness = setup()
    const { root, pluginManager } = harness
    const snap = {
      ...v4Session('MultiQuantitativeTrack', 'st_fresh', {
        type: 'LinearWiggleDisplay',
        configuration: 'st_fresh-LinearWiggleDisplay',
      }),
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'st_fresh',
          name: 'st_fresh',
          assemblyNames: ['volvox'],
          adapter: { type: 'MultiWiggleAdapter', bigWigs: ['a.bw', 'b.bw'] },
          displays: [
            {
              type: 'LinearWiggleDisplay',
              displayId: 'st_fresh-LinearWiggleDisplay',
              ...spelled,
            },
          ],
        },
      ],
    }
    await pluginManager.preloadSessionTypes(snap)
    root.setSession(snap)
    const display = root.session.views[0].tracks[0]?.displays[0]
    expect(display.type).toBe('LinearWiggleDisplay')
    expect(wiggleSlots(display)).toEqual(expected)
    expect(wiggleSlots(await reload(harness))).toEqual(expected)
  },
)

test('a multi-wiggle track a reader overlays stays overlaid after a reload', async () => {
  const harness = setup()
  const { root, pluginManager } = harness
  const snap = v4Session('MultiQuantitativeTrack', 'multi', {
    type: 'LinearWiggleDisplay',
    configuration: 'multi-LinearWiggleDisplay',
  })
  await pluginManager.preloadSessionTypes(snap)
  root.setSession(snap)
  const track = root.session.views[0].tracks[0]
  const display = track.displays[0]
  expect(display.type).toBe('LinearWiggleDisplay')
  expect(display.isRowLayout).toBe(true)
  display.setRowLayout(false)
  track.persistConfigurationNow()
  const reloaded = await reload(harness)
  expect(reloaded.isRowLayout).toBe(false)
  expect(getConf(reloaded, ['rows', 'field'])).toBe('')
})
