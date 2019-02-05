import MyPlugin from './index'
import JBrowse from '../../JBrowse'

test('plugin in a stock JBrowse', () => {
  // adding this plugin should fail because it is core
  expect(() =>
    new JBrowse().addPlugin(new MyPlugin()).configure(),
  ).toThrowErrorMatchingSnapshot()

  const jbrowse = new JBrowse().configure()
  const BigWigAdapter = jbrowse.pluginManager.getAdapterType('BigWigAdapter')
  const config = BigWigAdapter.configSchema.create({ type: 'BigWigAdapter' })
  expect(config).toMatchSnapshot({
    configId: expect.any(String),
  })
})
