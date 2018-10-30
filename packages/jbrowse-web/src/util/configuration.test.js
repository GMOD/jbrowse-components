import { getConfig } from './configuration'

import ModelFactory from '../RootModelFactory'
import JBrowse from '../JBrowse'
import snap1 from '../../test/root.snap.1.json'

const Model = ModelFactory(new JBrowse())
test('can fetch the config of the whole app', () => {
  const model = Model.create(snap1)
  const config = getConfig(model)
  expect(config.views.length).toBe(2)
})

test('config can be used to instantiate a new app root model', () => {
  const model = Model.create(snap1)
  const config = getConfig(model)

  const model2 = Model.create(config)
  expect(model2).toBeTruthy()
  expect(model2.views.length).toBe(2)
  expect(model2.views[0].tracks.length).toBe(3)
  expect(model2.views[0].offsetPx).toBe(0)
})
