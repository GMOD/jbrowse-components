import PluginManager from '../PluginManager.ts'
import RpcMethodType, { convertFileHandleLocations } from './RpcMethodType.ts'
import { setFileInCache, clearFileFromCache } from '../util/tracks.ts'

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

describe('convertFileHandleLocations', () => {
  afterEach(() => {
    clearFileFromCache('test-handle-1')
    clearFileFromCache('test-handle-2')
    clearFileFromCache('test-handle-nested')
  })

  test('converts FileHandleLocation to BlobLocation in object property', () => {
    const mockFile = new File(['test content'], 'test.bam', {
      type: 'application/octet-stream',
    })
    setFileInCache('test-handle-1', mockFile)

    const obj = {
      adapter: {
        fileLocation: {
          locationType: 'FileHandleLocation',
          handleId: 'test-handle-1',
          name: 'test.bam',
        },
      },
    }
    const blobMap: Record<string, File> = {}

    convertFileHandleLocations(obj, blobMap)

    const converted = obj.adapter.fileLocation as any
    expect(converted.locationType).toBe('BlobLocation')
    expect(converted.name).toBe('test.bam')
    expect(converted.blobId).toMatch(/^fh-rpc-\d+-\d+$/)
    expect(blobMap[converted.blobId]).toBe(mockFile)
  })

  test('converts FileHandleLocation in array', () => {
    const mockFile = new File(['test'], 'array-file.vcf')
    setFileInCache('test-handle-1', mockFile)

    const obj = {
      locations: [
        {
          locationType: 'FileHandleLocation',
          handleId: 'test-handle-1',
          name: 'array-file.vcf',
        },
      ],
    }
    const blobMap: Record<string, File> = {}

    convertFileHandleLocations(obj, blobMap)

    const converted = obj.locations[0] as any
    expect(converted.locationType).toBe('BlobLocation')
    expect(converted.name).toBe('array-file.vcf')
    expect(blobMap[converted.blobId]).toBe(mockFile)
  })

  test('converts multiple FileHandleLocations', () => {
    const mockFile1 = new File(['content1'], 'file1.bam')
    const mockFile2 = new File(['content2'], 'file2.bam.bai')
    setFileInCache('test-handle-1', mockFile1)
    setFileInCache('test-handle-2', mockFile2)

    const obj = {
      bamLocation: {
        locationType: 'FileHandleLocation',
        handleId: 'test-handle-1',
        name: 'file1.bam',
      },
      indexLocation: {
        locationType: 'FileHandleLocation',
        handleId: 'test-handle-2',
        name: 'file2.bam.bai',
      },
    }
    const blobMap: Record<string, File> = {}

    convertFileHandleLocations(obj, blobMap)

    expect((obj.bamLocation as any).locationType).toBe('BlobLocation')
    expect((obj.indexLocation as any).locationType).toBe('BlobLocation')
    expect(Object.keys(blobMap).length).toBe(2)
  })

  test('handles deeply nested FileHandleLocation', () => {
    const mockFile = new File(['nested'], 'nested.gff')
    setFileInCache('test-handle-nested', mockFile)

    const obj = {
      level1: {
        level2: {
          level3: {
            location: {
              locationType: 'FileHandleLocation',
              handleId: 'test-handle-nested',
              name: 'nested.gff',
            },
          },
        },
      },
    }
    const blobMap: Record<string, File> = {}

    convertFileHandleLocations(obj, blobMap)

    const converted = obj.level1.level2.level3.location as any
    expect(converted.locationType).toBe('BlobLocation')
    expect(blobMap[converted.blobId]).toBe(mockFile)
  })

  test('leaves non-FileHandleLocation objects unchanged', () => {
    const obj = {
      uriLocation: {
        locationType: 'UriLocation',
        uri: 'https://example.com/file.bam',
      },
      blobLocation: {
        locationType: 'BlobLocation',
        blobId: 'existing-blob',
        name: 'existing.bam',
      },
    }
    const blobMap: Record<string, File> = {}

    convertFileHandleLocations(obj, blobMap)

    expect(obj.uriLocation.locationType).toBe('UriLocation')
    expect(obj.blobLocation.locationType).toBe('BlobLocation')
    expect(obj.blobLocation.blobId).toBe('existing-blob')
    expect(Object.keys(blobMap).length).toBe(0)
  })

  test('throws error when file not in cache', () => {
    const obj = {
      location: {
        locationType: 'FileHandleLocation',
        handleId: 'nonexistent-handle',
        name: 'missing.bam',
      },
    }
    const blobMap: Record<string, File> = {}

    expect(() => {
      convertFileHandleLocations(obj, blobMap)
    }).toThrow(/File not in cache for handleId: nonexistent-handle/)
  })

  test('handles circular references without infinite loop', () => {
    const mockFile = new File(['circular'], 'circular.bam')
    setFileInCache('test-handle-1', mockFile)

    const obj: Record<string, unknown> = {
      location: {
        locationType: 'FileHandleLocation',
        handleId: 'test-handle-1',
        name: 'circular.bam',
      },
    }
    obj.self = obj

    const blobMap: Record<string, File> = {}

    convertFileHandleLocations(obj, blobMap)

    const converted = obj.location as any
    expect(converted.locationType).toBe('BlobLocation')
    expect(Object.keys(blobMap).length).toBe(1)
  })
})
