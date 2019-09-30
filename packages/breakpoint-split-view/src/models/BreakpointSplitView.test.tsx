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
            id: 123,
            data: {
              name: 'm64011_181218_235052/85067842/ccs',
              CIGAR:
                '7956S4=1D5=1X744=1D63=1X121=1I18=1X99=1X57=1I64=1D8=1X207=1D42=1I103=1X425=1X48=2I107=1I116=1X222=7D75=1D5=533S',
              SA:
                '3,186692690,+,7955M4D3081S,60,14;3,186700631,+,10597S438M1S,60,1;',
              start: 56758392,
              end: 56760944,
            },
          }),
        ],
        [
          456,
          new SimpleFeature({
            id: 456,
            data: {
              name: 'm64011_181218_235052/85067842/ccs',
              CIGAR:
                '919=1I420=1X191=1I1903=1D495=1D92=1X4=1X293=1D707=1X333=1X275=2D223=1D155=1X34=1X204=1X41=1X43=1X572=1X629=1X401=1X3=1X2=3081S',
              SA:
                '3,186700631,+,10597S438M1S,60,1;6,56758392,+,7956S2547M6D533S,22,8;',
              start: 186692690,
              end: 186700648,
            },
          }),
        ],
        [
          789,
          new SimpleFeature({
            id: 789,
            data: {
              name: 'm64011_181218_235052/85067842/ccs',
              CIGAR: '10597S11=1X426=1S',
              SA:
                '3,186692690,+,7955M4D3081S,60,14;6,56758392,+,7956S2547M6D533S,22,8;',
              start: 186692690,
              end: 186700648,
            },
          }),
        ],
      ])
    },
  }))

const ReactComponent = () => <>Hello World</>

stubManager.addViewType(
  () =>
    new ViewType({
      name: 'LinearGenomeView',
      stateModel: types
        .model('LinearGenomeView', {
          type: 'LinearGenomeView',
          tracks: types.array(FakeTrack),
        })
        .views(self => ({
          getTrack(configId: string) {
            return self.tracks.find(t => t.configuration.configId === configId)
          },
        })),
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

test('basic BreakpointSplitView test', () => {
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
