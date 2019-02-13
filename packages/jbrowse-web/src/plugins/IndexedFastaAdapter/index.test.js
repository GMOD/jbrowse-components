import MyPlugin from './index'
import JBrowse from '../../JBrowse'

test('plugin in a stock JBrowse', async () => {
  // adding this plugin should fail because it is core
  await expect(
    new JBrowse().addPlugin(new MyPlugin()).configure(),
  ).rejects.toThrowErrorMatchingSnapshot()

  const jbrowse = await new JBrowse().configure()
  const IndexedFastaAdapter = jbrowse.pluginManager.getAdapterType(
    'IndexedFastaAdapter',
  )
  const config = IndexedFastaAdapter.configSchema.create({
    type: 'IndexedFastaAdapter',
  })
  expect(config).toMatchSnapshot({
    configId: expect.any(String),
  })
})
