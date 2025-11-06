import MultiWiggleAdapter from './MultiWiggleAdapter'
import configSchema from './configSchema'

describe('MultiWiggleAdapter.getSources', () => {
  let adapter: MultiWiggleAdapter

  describe('with subadapters using URI locations', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [
            {
              type: 'BigWigAdapter',
              name: 'test-data-1',
              bigWigLocation: {
                uri: 'http://example.com/data/sample1.bw',
              },
            },
            {
              type: 'BigWigAdapter',
              name: 'test-data-2',
              bigWigLocation: {
                uri: 'http://example.com/data/sample2.bw',
              },
            },
          ],
        }),
      )

      // Mock getAdapters
      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'source-1',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'http://example.com/data/sample1.bw',
          },
          dataAdapter: {} as any,
        },
        {
          source: 'source-2',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'http://example.com/data/sample2.bw',
          },
          dataAdapter: {} as any,
        },
      ])
    })

    it('should return sources with correct names extracted from URI', async () => {
      const sources = await adapter.getSources([
        {
          refName: 'chr1',
          start: 0,
          end: 100000,
          assemblyName: 'hg38',
        },
      ])

      expect(sources).toHaveLength(2)
      expect(sources[0]!).toMatchObject({
        name: 'sample1',
        source: 'source-1',
        type: 'BigWigAdapter',
      })
      expect(sources[1]!).toMatchObject({
        name: 'sample2',
        source: 'source-2',
        type: 'BigWigAdapter',
      })
    })

    it('should preserve bigWigLocation property', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toHaveProperty('bigWigLocation')
      // @ts-expect-error
      expect(sources[0]!.bigWigLocation).toEqual({
        uri: 'http://example.com/data/sample1.bw',
      })
    })
  })

  describe('with subadapters using localPath', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [
            {
              type: 'BigWigAdapter',
              bigWigLocation: {
                localPath: '/home/user/data/file1.bw',
              },
            },
          ],
        }),
      )

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'file1-source',
          type: 'BigWigAdapter',
          bigWigLocation: {
            localPath: '/home/user/data/file1.bw',
          },
          dataAdapter: {} as any,
        },
      ])
    })

    it('should extract filename from localPath', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'file1',
        source: 'file1-source',
      })
    })
  })

  describe('with subadapters using blob', () => {
    beforeEach(() => {
      const mockFile = new File(['data'], 'sample-blob.bw')

      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [
            {
              type: 'BigWigAdapter',
              bigWigLocation: {
                blob: mockFile,
              },
            },
          ],
        }),
      )

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'blob-source',
          type: 'BigWigAdapter',
          bigWigLocation: {
            blob: mockFile,
          },
          dataAdapter: {} as any,
        },
      ])
    })

    it('should extract filename from blob name', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'sample-blob',
        source: 'blob-source',
      })
    })
  })

  describe('with fallback to name property', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [
            {
              type: 'BigWigAdapter',
              name: 'provided-name',
              bigWigLocation: {
                uri: 'http://example.com/data/sample.bw',
              },
            },
          ],
        }),
      )

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'auto-source',
          name: 'provided-name',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'http://example.com/data/sample.bw',
          },
          dataAdapter: {} as any,
        },
      ])
    })

    it('should use provided name when available', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'provided-name',
        source: 'auto-source',
      })
    })
  })

  describe('with fallback to source property', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [],
        }),
      )

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'fallback-source',
          type: 'OtherAdapter',
          dataAdapter: {} as any,
        },
      ])
    })

    it('should use source when name and filename extraction fail', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'fallback-source',
        source: 'fallback-source',
      })
    })
  })

  describe('with empty array', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(configSchema.create({}))

      adapter.getAdapters = jest.fn().mockResolvedValue([])
    })

    it('should return empty array when no adapters', async () => {
      const sources = await adapter.getSources([])

      expect(sources).toEqual([])
    })
  })

  describe('with additional properties', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [
            {
              type: 'BigWigAdapter',
              bigWigLocation: {
                uri: 'http://example.com/data/test.bw',
              },
              customProp: 'custom-value',
              anotherProp: 42,
            },
          ],
        }),
      )

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'test-source',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'http://example.com/data/test.bw',
          },
          customProp: 'custom-value',
          anotherProp: 42,
          dataAdapter: {} as any,
        },
      ])
    })

    it('should preserve custom properties in returned sources', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'test',
        source: 'test-source',
        type: 'BigWigAdapter',
        customProp: 'custom-value',
        anotherProp: 42,
      })
    })

    it('should exclude dataAdapter from returned sources', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).not.toHaveProperty('dataAdapter')
    })
  })

  describe('with complex URIs', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(configSchema.create({}))

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'test1',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'http://example.com/path/to/deep/nested/sample.bw',
          },
          dataAdapter: {} as any,
        },
        {
          source: 'test2',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'file:///local/path/file.with.dots.bw',
          },
          dataAdapter: {} as any,
        },
        {
          source: 'test3',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'https://s3.amazonaws.com/bucket/key/data.no-extension',
          },
          dataAdapter: {} as any,
        },
      ])
    })

    it('should correctly extract filename from nested paths', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!.name).toBe('sample')
      expect(sources[1]!.name).toBe('file.with.dots')
      expect(sources[2]!.name).toBe('data')
    })
  })

  describe('regions parameter handling', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(configSchema.create({}))

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'test-source',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'http://example.com/data/test.bw',
          },
          dataAdapter: {} as any,
        },
      ])
    })

    it('should ignore regions parameter and return same sources', async () => {
      const regions1 = [
        { refName: 'chr1', start: 0, end: 1000, assemblyName: 'hg38' },
      ]
      const regions2 = [
        { refName: 'chr2', start: 5000, end: 10000, assemblyName: 'hg38' },
      ]

      const sources1 = await adapter.getSources(regions1)
      const sources2 = await adapter.getSources(regions2)

      expect(sources1).toEqual(sources2)
    })
  })
})
