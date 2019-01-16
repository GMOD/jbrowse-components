import { getSnapshot } from 'mobx-state-tree'
import JBrowse from './JBrowse'

test('can load configuration with the configure() action and resolve references to view configurations', () => {
  const jbrowse = new JBrowse().configure()
  const { model } = jbrowse
  model.configure({
    configId: 'fogbat',
    views: { LinearGenomeView: { configId: 'LinearGenomeView' } },
  })

  expect(getSnapshot(model.configuration)).toMatchSnapshot()
})
