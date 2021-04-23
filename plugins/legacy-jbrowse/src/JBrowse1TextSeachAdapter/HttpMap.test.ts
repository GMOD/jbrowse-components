import path from 'path'
import { URL } from 'url'
import HttpMap from './HttpMap'

describe('test JBrowse1 httpMap implementation', () => {
  test('test creating a HttpMap', async () => {
    const rootTemplate = path
      .join(__dirname, '..', '..', '..', '..', 'test_data', 'volvox')
      .replace(/\\/g, '\\\\')
    const configSchemaTest = {
      uri: `${decodeURI(new URL(`file://${rootTemplate}`).href)}/names`,
    }
    const testHttpMap = new HttpMap({
      url: configSchemaTest.baseUri
        ? new URL(configSchemaTest.uri, configSchemaTest.baseUri).href
        : configSchemaTest.uri,
      isElectron: false,
    })
    expect(testHttpMap).toBeTruthy()
  })
})
