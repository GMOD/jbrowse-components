import PluginManager from '../PluginManager'
import RpcMethodType from './RpcMethodType'

const pluginManager = new PluginManager()

export class MockRpcMethodType extends RpcMethodType {
  async execute() {}
}

test('test serialize arguments with augmentLocationObject', async () => {
  const mockRpc = new MockRpcMethodType(pluginManager)
  mockRpc.serializeNewAuthArguments = jest.fn().mockReturnValue({
    internetAccountId: 'HTTPBasicInternetAccount-test',
    locationType: 'UriLocation',
    uri: 'test',
  })
  const locationInAdapter = {
    internetAccountId: 'HTTPBasicInternetAccount-test',
    locationType: 'UriLocation',
    uri: 'test',
  }
  const deeplyNestedLocation = {
    internetAccountId: 'HTTPBasicInternetAccount-test2',
    locationType: 'UriLocation',
    uri: 'test2',
  }

  await mockRpc.serializeArguments(
    {
      adapter: {
        testLocation: locationInAdapter,
      },
      filters: [],
      parentObject: {
        nestedObject: {
          arrayInNestedObject: [deeplyNestedLocation],
        },
      },
      randomProperty: 'randomstring',
      signal: 'teststring',
    },
    '',
  )
  expect(mockRpc.serializeNewAuthArguments).toHaveBeenCalledTimes(2)
  expect(mockRpc.serializeNewAuthArguments).toHaveBeenCalledWith(
    locationInAdapter,
    '',
  )
  expect(mockRpc.serializeNewAuthArguments).toHaveBeenCalledWith(
    deeplyNestedLocation,
    '',
  )
})
