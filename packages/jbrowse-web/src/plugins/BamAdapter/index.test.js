import MyPlugin from './index'
import JBrowse from '../../JBrowse'

test('plugin in a stock JBrowse', () => {
  // adding this plugin should fail because it is core
  expect(() =>
    new JBrowse().addPlugin(new MyPlugin()).configure(),
  ).toThrowErrorMatchingSnapshot()

  const jbrowse = new JBrowse().configure()
  const BamAdapter = jbrowse.getAdapterType('BamAdapter')
  const config = BamAdapter.configSchema.create({ type: 'BamAdapter' })
  expect(config).toMatchSnapshot()
})
