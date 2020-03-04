import { render } from '@testing-library/react'
import {types } from 'mobx-state-tree'
import ViewType from '@gmod/jbrowse-core/pluggableElementTypes/ViewType'
import React from 'react'
import LinearSyntenyTrack from './LinearSyntenyTrack'
import { stateModelFactory,configSchemaFactory } from '..'

const ReactComponent = () => <p>Hello World</p>
const getView = () => {
  const stubManager = new PluginManager()
  const FakeTrack = types
    .model('FakeTrack', {
      trackId: 'FakeTrack',
      type: 'FakeTrack',
      features: types.frozen(),
      layoutFeatures: types.frozen(),
      configuration: types.frozen(),
    })
    .actions(self => ({
      afterCreate() {
        self.features = new Map(Object.entries(self.features))
        self.layoutFeatures = new Map(Object.entries(self.layoutFeatures))
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
        RenderingComponent: true,
      }),
  )

  stubManager.configure()
  const config = configSchemaFactory(stubManager)
  return stateModelFactory(stubManager, config)
}

test('test', () => {
  const model = stateModelFactory(.create({})
  const { container } = render(<LinearSyntenyTrack model={model} />)
  expect(container).toMatchSnapshot()
  expect(1).toBe(1)
})
