import MyPlugin from './index'
import JBrowse from '../../JBrowse'

test('plugin in a stock JBrowse', async () => {
  // adding this plugin should fail because it is core
  await expect(
    new JBrowse().addPlugin(new MyPlugin()).configure(),
  ).rejects.toThrowErrorMatchingSnapshot()

  const jbrowse = await new JBrowse().configure()
  const BigWigAdapter = jbrowse.pluginManager.getAdapterType('BigWigAdapter')
  const config = BigWigAdapter.configSchema.create({ type: 'BigWigAdapter' })
  expect(config).toMatchSnapshot({
    configId: expect.any(String),
  })
})
