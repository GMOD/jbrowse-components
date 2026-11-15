import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

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
          uniqueId: 'volvox-ctgA',
          start: 0,
          end: 1000,
          seq: 'a'.repeat(1000),
        },
      ],
    },
  },
}

const reads = {
  trackId: 'reads',
  type: 'FeatureTrack',
  name: 'reads',
  assemblyNames: ['volvox'],
  adapter: { type: 'FromConfigAdapter', features: [] },
}

function read(uniqueId: string) {
  return { uniqueId, refName: 'ctgA', start: 10, end: 110, flags: 2049 }
}

async function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assembly)
  session.addTrackConf(reads)
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  await view.launchTrack('reads')
  return { session, view, track: view.tracks[0] }
}

test('a session widget saved as featureData with feature1 and feature2 loads as its two reads', async () => {
  const { session } = await setup()
  const widget = session.addWidget(
    'BreakpointAlignmentsWidget',
    'breakpointAlignments',
    { featureData: { feature1: read('one'), feature2: read('two') } },
  )
  expect(widget).toHaveProperty('read1.featureData.uniqueId', 'one')
  expect(widget).toHaveProperty('read2.featureData.uniqueId', 'two')
}, 30000)

test('another widget type opened beside it keeps its own type', async () => {
  const { session } = await setup()
  const widget = session.addWidget('VariantFeatureWidget', 'variantFeature', {
    featureData: read('one'),
  })
  expect(widget.type).toBe('VariantFeatureWidget')
}, 30000)

test('each read keeps its row view and track through a snapshot', async () => {
  const { session, view, track } = await setup()
  const widget = session.addWidget(
    'BreakpointAlignmentsWidget',
    'breakpointAlignments',
    {
      read1: { featureData: read('one'), view, track },
      read2: { featureData: read('two'), view, track },
    },
  )
  expect(widget).toHaveProperty('read1.view', view)
  expect(widget).toHaveProperty('read2.track', track)
  expect(getSnapshot(widget)).toMatchObject({
    read1: {
      view: view.id,
      trackId: 'reads',
      featureData: { uniqueId: 'one' },
    },
  })
}, 30000)
