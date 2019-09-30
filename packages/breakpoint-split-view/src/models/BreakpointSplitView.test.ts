import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import ViewType from '@gmod/jbrowse-core/pluggableElementTypes/ViewType'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { types, Instance } from 'mobx-state-tree'
import BaseTrack from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/baseTrackModel'
import {
  ReactComponent,
  stateModelFactory as lgvStateModelFactory,
} from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import stateModelFactory, {
  BreakpointViewStateModel,
} from './BreakpointSplitView'

// a stub linear genome view state model that only accepts base track types.
// used in unit tests.
const stubManager = new PluginManager()
stubManager.addViewType(
  () =>
    new ViewType({
      name: 'LinearGenomeView',
      stateModel: lgvStateModelFactory(stubManager),
      ReactComponent,
      RenderingComponent: true,
    }),
)
stubManager.addTrackType(
  () =>
    new TrackType({
      name: 'Base',
      stateModel: BaseTrack,
      RenderingComponent: true,
    }),
)
stubManager.configure()
const BreakpointSplitView = stateModelFactory(stubManager)

const configuration = {
  configId: 'pacbio_hg002',
  type: 'AlignmentsTrack',
  name: 'HG002.hs37d5.11kb',
  category: ['PacBio', 'BAM'],
  adapter: {
    configId: 'yqdN4rtSSS',
    type: 'BamAdapter',
    bamLocation: { uri: 'test_data/pacbio_chr3_chr6.bam' },
    index: {
      configId: 'z0jYC37_2h',
      location: { uri: 'test_data/pacbio_chr3_chr6.bam.bai' },
    },
  },
  renderers: {
    configId: 'XKcazRjYUO',
    PileupRenderer: {
      configId: 'G71Pm63GoW',
      type: 'PileupRenderer',
    },
    SvgFeatureRenderer: {
      configId: 'r7zVi_Jgrt',
      type: 'SvgFeatureRenderer',
      labels: { configId: 'tVwnQLG0u4' },
    },
  },
}

test('can instantiate a mostly empty model and read a default configuration value', () => {
  const name = types
    .model({
      name: 'testSession',
      view: types.maybe(BreakpointSplitView.stateModel),
      configuration: types.frozen(),
    })
    .actions(self => ({
      setView(view: Instance<BreakpointViewStateModel>) {
        self.view = view
        return view
      },
    }))
    .create({
      configuration,
    })

  const model = name.setView(
    BreakpointSplitView.stateModel.create({
      type: 'BreakpointSplitView',
      topLGV: {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      },
      bottomLGV: {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      },
    }),
  )

  expect(model.topLGV).toBeTruthy()
  expect(model.bottomLGV).toBeTruthy()
  expect(model.trackSelectorType).toBe('hierarchical')
})

test('can instantiate a model that has a track', () => {
  const name = types
    .model({
      name: 'testSession',
      view: types.maybe(BreakpointSplitView.stateModel),
      configuration: types.frozen(),
    })
    .actions(self => ({
      setView(view: Instance<BreakpointViewStateModel>) {
        self.view = view
        return view
      },
    }))
    .create({
      configuration: {},
    })

  const model = name.setView(
    BreakpointSplitView.stateModel.create({
      id: 'MiDMyyWpp',
      type: 'BreakpointSplitView',
      headerHeight: 44,
      width: 1466,
      height: 400,
      displayName: 'pbsv.BND.3:186700648-6:56758392 split detail',
      configuration: { configId: 'If_2Pn2OmT', type: 'BreakpointSplitView' },
      trackSelectorType: 'hierarchical',
      topLGV: {
        id: 'AcZl9Uifbv',
        type: 'LinearGenomeView',
        offsetPx: 18669642.20825393,
        bpPerPx: 10,
        displayedRegions: [
          { refName: '3', start: 0, end: 186700647, assemblyName: 'hg19' },
          {
            refName: '3',
            start: 186700647,
            end: 198022430,
            assemblyName: 'hg19',
          },
        ],
        reversed: false,
        tracks: [
          {
            id: 'yQ2EdXaSBc',
            type: 'AlignmentsTrack',
            height: 100,
            configuration: 'pacbio_hg002',
            selectedRendering: '',
          },
        ],
        controlsWidth: 120,
        width: 800,
        hideControls: false,
        hideHeader: true,
        hideCloseButton: true,
        trackSelectorType: 'hierarchical',
        minimumBlockWidth: 20,
      },
      bottomLGV: {
        id: '0Q9aAu1h7g',
        type: 'LinearGenomeView',
        offsetPx: 5675435.581319785,
        bpPerPx: 10,
        displayedRegions: [
          { refName: '6', start: 0, end: 56758391, assemblyName: 'hg19' },
          {
            refName: '6',
            start: 56758391,
            end: 171115067,
            assemblyName: 'hg19',
          },
        ],
        reversed: false,
        tracks: [
          {
            id: 'SKJqZhlLV5',
            type: 'AlignmentsTrack',
            height: 100,
            configuration: 'pacbio_hg002',
            selectedRendering: '',
          },
        ],
        controlsWidth: 120,
        width: 800,
        hideControls: false,
        hideHeader: true,
        hideCloseButton: true,
        trackSelectorType: 'hierarchical',
        minimumBlockWidth: 20,
      },
    }),
  )

  expect(model.topLGV).toBeTruthy()
  expect(model.topLGV.tracks[0]).toBeTruthy()
  expect(model.bottomLGV).toBeTruthy()
  expect(model.trackSelectorType).toBe('hierarchical')
})
