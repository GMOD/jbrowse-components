import MyPlugin from './index'
import JBrowse from '../../JBrowse'

test('plugin in a stock JBrowse', async () => {
  // adding this plugin should fail because it is core
  await expect(
    new JBrowse().addPlugin(new MyPlugin()).configure(),
  ).rejects.toThrowErrorMatchingSnapshot()

  const jbrowse = await new JBrowse().configure()
  const adapter = jbrowse.pluginManager.getAdapterType('FromConfigAdapter')
  const config = adapter.configSchema.create({
    type: 'FromConfigAdapter',
  })
  expect(config).toMatchSnapshot({
    configId: expect.any(String),
  })
})
