import path from 'path'
import Adapter from './JBrowse1TextSearchAdater'
import configSchema from './configSchema'

test('adapter can fetch files from names index', async () => {
  const rootTemplate = path
    .join(__dirname, '..', '..', '..', '..', 'test_data')
    .replace(/\\/g, '\\\\')

  const args = {
    type: 'JBrowse1TextSearchAdapter',
    textSearchAdapterId: 'JBrowse1GenerateNamesAdapterTest',
    namesIndexLocation: { uri: `${rootTemplate}/volvox/names` },
  }
  const adapter = new Adapter(configSchema.create(args))
  expect(adapter).toBeTruthy()
})
