import React from 'react'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import PluginManager from '@jbrowse/core/PluginManager'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { types, Instance } from 'mobx-state-tree'
import stateModelFactory, { BreakpointViewStateModel } from './model'

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  // @ts-ignore
  console.warn.mockRestore()
})

const getView = () => {
  const stubManager = new PluginManager()
  const FakeTrack = types
    .model('FakeTrack', {
      trackId: 'FakeTrack',
      type: 'FakeTrack',
      configuration: types.frozen(),
      displays: types.array(
        types.model('FakeDisplay', {
          type: 'FakeDisplay',
          displayId: 'FakeDisplay',
          configuration: types.frozen(),
          features: types.frozen(),
          layoutFeatures: types.frozen(),
        }),
      ),
    })
    .actions(self => ({
      afterCreate() {
        self.displays[0].features = new Map(
          Object.entries(self.displays[0].features),
        )
        self.displays[0].layoutFeatures = new Map(
          Object.entries(self.displays[0].layoutFeatures),
        )
      },
    }))
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
            getTrack(trackConfigId: string) {
              return self.tracks.find(
                t => t.configuration.trackId === trackConfigId,
              )
            },
          })),
        ReactComponent,
      }),
  )

  stubManager.createPluggableElements()
  stubManager.configure()
  return stateModelFactory(stubManager)
}

// this implements an entire "track type" to supply some features to the
// breakpoint split view (three pacbio reads on chr3 and chr6)

const ReactComponent = () => <>Hello World</>

test('BreakpointSplitView with soft clipping', () => {
  const BreakpointSplitView = getView()
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
      type: 'BreakpointSplitView',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              configuration: { trackId: 'pacbio_hg002' },
              type: 'AlignmentsTrack',
              displays: [
                {
                  configuration: { displayId: 'pacbio_hg002_pileup' },
                  type: 'LinearPileupDisplay',
                  layoutFeatures: {
                    456: [0, 0, 100, 10],
                    789: [0, 0, 100, 10],
                  },
                  features: {
                    456: new SimpleFeature({
                      id: 456,
                      data: {
                        name: 'm64011_181218_235052/85067842/ccs',
                        clipPos: 0,
                        CIGAR:
                          '919=1I420=1X191=1I1903=1D495=1D92=1X4=1X293=1D707=1X333=1X275=2D223=1D155=1X34=1X204=1X41=1X43=1X572=1X629=1X401=1X3=1X2=3081S',
                        SA:
                          '3,186700631,+,10597S438M1S,60,1;6,56758392,+,7956S2547M6D533S,22,8;',
                        start: 186692690,
                        end: 186700648,
                      },
                    }),
                    789: new SimpleFeature({
                      id: 789,
                      data: {
                        name: 'm64011_181218_235052/85067842/ccs',
                        clipPos: 10597,
                        CIGAR: '10597S11=1X426=1S',
                        SA:
                          '3,186692690,+,7955M4D3081S,60,14;6,56758392,+,7956S2547M6D533S,22,8;',
                        start: 186692690,
                        end: 186700648,
                      },
                    }),
                  },
                },
              ],
            },
          ],
        },
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              configuration: { trackId: 'pacbio_hg002' },
              type: 'AlignmentsTrack',
              displays: [
                {
                  configuration: { displayId: 'pacbio_hg002_pileup' },
                  type: 'LinearPileupDisplay',
                  layoutFeatures: { 123: [0, 0, 100, 10] },
                  features: {
                    123: new SimpleFeature({
                      id: 123,
                      data: {
                        name: 'm64011_181218_235052/85067842/ccs',
                        clipPos: 7956,
                        CIGAR:
                          '7956S4=1D5=1X744=1D63=1X121=1I18=1X99=1X57=1I64=1D8=1X207=1D42=1I103=1X425=1X48=2I107=1I116=1X222=7D75=1D5=533S',
                        SA:
                          '3,186692690,+,7955M4D3081S,60,14;3,186700631,+,10597S438M1S,60,1;',
                        start: 56758392,
                        end: 56760944,
                      },
                    }),
                  },
                },
              ],
            },
          ],
        },
      ],
    }),
  )

  expect(model.views[0]).toBeTruthy()
  expect(model.views[1]).toBeTruthy()
  expect(model.trackSelectorType).toBe('hierarchical')
  expect(model.matchedTracks).toMatchSnapshot()
  const feats = model.getMatchedAlignmentFeatures('pacbio_hg002')
  expect(feats).toMatchSnapshot()
  expect(
    model.getMatchedFeaturesInLayout('pacbio_hg002', feats),
  ).toMatchSnapshot()
})

test('BreakpointSplitView with hard clipping', () => {
  const BreakpointSplitView = getView()
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
      type: 'BreakpointSplitView',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              configuration: { trackId: 'volvox_samspec' },
              type: 'AlignmentsTrack',
              displays: [
                {
                  configuration: { trackId: 'volvox_samspec_pileup' },
                  type: 'LinearPileupDisplay',
                  layoutFeatures: {
                    123: [0, 0, 100, 10],
                    456: [0, 0, 100, 10],
                  },
                  features: {
                    123: new SimpleFeature({
                      id: 123,
                      data: {
                        name: 'r003',
                        CIGAR: '5S6M',
                        SA: 'ref,29,-,6H5M,17,0;',
                        start: 8,
                        end: 12,
                      },
                    }),
                    456: new SimpleFeature({
                      id: 456,
                      data: {
                        name: 'r003',
                        CIGAR: '6H5M',
                        SA: 'ref,9,+,5S6M,30,1',
                        start: 28,
                        end: 32,
                      },
                    }),
                  },
                },
              ],
            },
          ],
        },
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              configuration: { trackId: 'volvox_samspec' },
              type: 'AlignmentsTrack',
              displays: [
                {
                  configuration: { trackId: 'volvox_samspec_pileup' },
                  type: 'LinearPileupDisplay',
                  layoutFeatures: {},
                  features: {},
                },
              ],
            },
          ],
        },
      ],
    }),
  )

  expect(model.views[0]).toBeTruthy()
  expect(model.views[1]).toBeTruthy()
  expect(model.trackSelectorType).toBe('hierarchical')
  expect(model.matchedTracks).toMatchSnapshot()
  expect(model.getMatchedAlignmentFeatures('nonexist')).toEqual([])
  const feats = model.getMatchedAlignmentFeatures('volvox_samspec')
  expect(feats).toMatchSnapshot()
  expect(
    model.getMatchedFeaturesInLayout('volvox_samspec', feats),
  ).toMatchSnapshot()
})
