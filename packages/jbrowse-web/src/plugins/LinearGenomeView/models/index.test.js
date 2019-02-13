import { types } from 'mobx-state-tree'
import { getConf } from '../../../configuration'
import { TestStub as LinearGenomeModel } from '.'
import JBrowse from '../../../JBrowse'

test('can instantiate a mostly empty model and read a default configuration value', () => {
  const root = types
    .model({
      view: types.maybe(LinearGenomeModel),
    })
    .actions(self => ({
      setView(view) {
        self.view = view
        return view
      },
    }))
    .create({
      config: {},
    })

  const model = root.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      configuration: {},
    }),
  )

  expect(root.view.tracks[0]).toBeTruthy()
  expect(getConf(model, 'trackSelectorType')).toBe('hierarchical')
})

it('can run configuration', async () => {
  const jb = await new JBrowse().configure({
    views: {
      LinearGenomeView: {},
    },
  })
  const { model } = jb
  const view = model.addView('LinearGenomeView')
  view.activateConfigurationUI()
})
