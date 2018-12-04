import { getSnapshot, resolveIdentifier } from 'mobx-state-tree'
import JBrowse from './JBrowse'
import rootModel from './rootModel'

test('can load configuration with the configure() action and resolve references to view configurations', () => {
  const jbrowse = new JBrowse().configure()
  const { model } = jbrowse
  model.configure({
    _configId: 'fogbat',
    views: { LinearGenomeView: { _configId: 'LinearGenomeView' } },
  })

  expect(getSnapshot(model.configuration)).toMatchSnapshot()
})
