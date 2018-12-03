import { getSnapshot } from 'mobx-state-tree'
import JBrowse from './JBrowse'
import rootModel from './rootModel'

test('can load configuration with the configure() action', () => {
  const jbrowse = new JBrowse().configure()
  const { model } = jbrowse
  model.configure({ _configId: 'fogbat' })
  expect(getSnapshot(model.configuration)).toEqual({ _configId: 'fogbat' })
})
