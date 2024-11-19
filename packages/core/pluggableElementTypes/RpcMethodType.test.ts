import PluginManager from '../PluginManager'
import RpcMethodType from './RpcMethodType'

const pluginManager = new PluginManager()

class MockRpcMethodType extends RpcMethodType {
  async execute() {}
}

test('test serialize arguments with augmentLocationObject', async () => {
  const mockRpc = new MockRpcMethodType(pluginManager)
  mockRpc.serializeNewAuthArguments = jest.fn().mockReturnValue({
    locationType: 'UriLocation',
    uri: 'test',
    internetAccountId: 'HTTPBasicInternetAccount-test',
  })
  const locationInAdapter = {
    locationType: 'UriLocation',
    uri: 'test',
    internetAccountId: 'HTTPBasicInternetAccount-test',
  }
  const deeplyNestedLocation = {
    locationType: 'UriLocation',
    uri: 'test2',
    internetAccountId: 'HTTPBasicInternetAccount-test2',
  }

  await mockRpc.serializeArguments(
    {
      adapter: {
        testLocation: locationInAdapter,
      },
      filters: [],
      stopToken: 'teststring',
      randomProperty: 'randomstring',
      parentObject: {
        nestedObject: {
          arrayInNestedObject: [deeplyNestedLocation],
        },
      },
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
