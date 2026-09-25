import PluginManager from '@jbrowse/core/PluginManager'
import { getConf } from '@jbrowse/core/configuration'

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
