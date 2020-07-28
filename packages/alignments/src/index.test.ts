import PluginManager from '@gmod/jbrowse-core/PluginManager'
import SVG from '@gmod/jbrowse-plugin-svg'
import { getSnapshot, types } from 'mobx-state-tree'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import ThisPlugin from '.'

const createMockTrackStateModel = (
  track: TrackType,
  trackTwo: TrackType,
  trackThree: TrackType,
) =>
  types
    .model({
      name: 'testSession',
      selectedFeature: types.frozen(),
      bpPerPx: 0.05,
      staticBlocks: types.frozen(),
      PileupTrack: types.maybe(trackTwo.stateModel),
      SNPCoverageTrack: types.maybe(trackThree.stateModel),
      track: track.stateModel,
      pluginManager: 'mockPluginManager',
      configuration: 'mockConfiguration',
      selection: types.frozen(),
    })
    .actions(self => {
      return {
        setSelection(thing: unknown) {
          self.selection = thing
        },
        clearSelection() {
          self.selection = undefined
        },
        showTrack() {},
        hideTrack() {},
      }
    })

const createMockTrack = (
  track: TrackType,
  pileup: TrackType,
  snpcoverage: TrackType,
) =>
  createMockTrackStateModel(track, pileup, snpcoverage).create({
    staticBlocks: { contentBlocks: [] },
    track: {
      configuration: track.configSchema.create({
        type: 'AlignmentsTrack',
        trackId: 'track0',
      }),
      type: 'AlignmentsTrack',
    },
    PileupTrack: {
      configuration: pileup.configSchema.create({
        type: 'PileupTrack',
        name: 'track0_pileup',
        trackId: 'track0_pileup',
      }),
      type: 'PileupTrack',
    },
    SNPCoverageTrack: {
      configuration: snpcoverage.configSchema.create({
        type: 'SNPCoverageTrack',
        name: 'track0_snpcoverage',
        trackId: 'track0_snpcoverage',
      }),
      type: 'SNPCoverageTrack',
    },
  })

test('create bam adapter config', () => {
  const pluginManager = new PluginManager([new ThisPlugin(), new SVG()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const BamAdapter = pluginManager.getAdapterType('BamAdapter')
  const config = BamAdapter.configSchema.create({ type: 'BamAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot()
})

test('create track config', () => {
  const pluginManager = new PluginManager([new ThisPlugin(), new SVG()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const AlignmentsTrack = pluginManager.getTrackType('AlignmentsTrack')
  const config2 = AlignmentsTrack.configSchema.create({
    type: 'AlignmentsTrack',
    trackId: 'track0',
  })
  expect(getSnapshot(config2)).toMatchSnapshot()
})

test('has pileup and alignment tracks', () => {
  const pluginManager = new PluginManager([new ThisPlugin(), new SVG()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const sessionModel = createMockTrack(
    pluginManager.getTrackType('AlignmentsTrack'),
    pluginManager.getTrackType('PileupTrack'),
    pluginManager.getTrackType('SNPCoverageTrack'),
  )

  expect(sessionModel.PileupTrack).toBeTruthy()
  expect(sessionModel.SNPCoverageTrack).toBeTruthy()
})

test('test selection in alignments track model with mock session', () => {
  const pluginManager = new PluginManager([new ThisPlugin(), new SVG()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const sessionModel = createMockTrack(
    pluginManager.getTrackType('AlignmentsTrack'),
    pluginManager.getTrackType('PileupTrack'),
    pluginManager.getTrackType('SNPCoverageTrack'),
  )

  // TODO: requires having actual session.addWidget
  // sessionModel.track.selectFeature({
  //   id() {
  //     return 1234
  //   },
  // })
  // expect(sessionModel.selection.id()).toBe(1234)

  expect(sessionModel.selection).not.toBeTruthy()
})

test('plugin in a stock JBrowse', () => {
  const pluginManager = new PluginManager([new ThisPlugin(), new SVG()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const BamAdapter = pluginManager.getAdapterType('BamAdapter')
  const config = BamAdapter.configSchema.create({ type: 'BamAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot()
})
