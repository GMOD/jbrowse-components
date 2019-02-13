import MyPlugin from './index'
import JBrowse from '../../JBrowse'

test('plugin in a stock JBrowse', async () => {
  // adding this plugin should fail because it is core
  await expect(
    new JBrowse().addPlugin(new MyPlugin()).configure(),
  ).rejects.toThrowErrorMatchingSnapshot()

  const jbrowse = await new JBrowse().configure()
  const TwoBitAdapter = jbrowse.pluginManager.getAdapterType('TwoBitAdapter')
  const config = TwoBitAdapter.configSchema.create({ type: 'TwoBitAdapter' })
  expect(config).toMatchSnapshot({
    configId: expect.any(String),
  })
})
