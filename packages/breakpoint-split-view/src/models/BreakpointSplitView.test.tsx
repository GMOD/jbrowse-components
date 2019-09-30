/* eslint-disable @typescript-eslint/explicit-function-return-type */
import React from 'react'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import ViewType from '@gmod/jbrowse-core/pluggableElementTypes/ViewType'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import { types, Instance } from 'mobx-state-tree'
import BaseTrack from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/baseTrackModel'
import stateModelFactory, {
  BreakpointViewStateModel,
} from './BreakpointSplitView'

// a stub linear genome view state model that only accepts base track types.
// used in unit tests.
const stubManager = new PluginManager()
const FakeTrack = types
  .model('FakeTrack', { type: 'FakeTrack', configuration: types.frozen() })
  .views(self => ({
    get layoutFeatures() {
      return new Map([[123, [0, 0, 100, 10]], [456, [0, 0, 100, 10]]])
    },
    get features() {
      return new Map([
        [
          123,
          new SimpleFeature({
            id: 'test1',
            data: { name: 'match', CIGAR: '20M', start: 123, end: 456 },
          }),
        ],
        [
          456,
          new SimpleFeature({
            id: 'test2',
            data: { name: 'match', CIGAR: '6S10M', start: 789, end: 999 },
          }),
        ],
      ])
    },
  }))

const FakeLinearGenomeView = types
  .model('LinearGenomeView', {
    type: 'LinearGenomeView',
    tracks: types.array(FakeTrack),
  })
  .views(self => ({
    getTrack(configId: string) {
      return self.tracks.find(t => t.configuration.configId === configId)
    },
  }))
const ReactComponent = () => <>Hello World</>

stubManager.addViewType(
  () =>
    new ViewType({
      name: 'LinearGenomeView',
      stateModel: FakeLinearGenomeView,
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
  tracks: [
    {
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
    },
  ],
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
    // @ts-ignore
    BreakpointSplitView.stateModel.create({
      type: 'BreakpointSplitView',
      topLGV: {
        type: 'LinearGenomeView',
        tracks: [
          {
            configuration: { configId: 'pacbio_hg002' },
            type: 'AlignmentsTrack',
          },
        ],
      },
      bottomLGV: {
        type: 'LinearGenomeView',
        tracks: [
          {
            configuration: { configId: 'pacbio_hg002' },
            type: 'AlignmentsTrack',
          },
        ],
      },
    }),
  )

  expect(model.topLGV).toBeTruthy()
  expect(model.bottomLGV).toBeTruthy()
  expect(model.trackSelectorType).toBe('hierarchical')
  expect(model.matchedTracks).toMatchSnapshot()
  expect(model.getMatchedFeatures('pacbio_hg002')).toMatchSnapshot()
  expect(model.getLayoutMatches('pacbio_hg002')).toMatchSnapshot()
})
