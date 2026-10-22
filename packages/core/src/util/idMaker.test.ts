import {
  adapterConfigCacheKey,
  withAdapterId,
} from '../data_adapters/dataAdapterCache.ts'
import idMaker from './idMaker.ts'

describe('idMaker', () => {
  test('normalizes FileHandleLocation to BlobLocation for consistent hashing', () => {
    const fileHandleConfig = {
      type: 'Gff3Adapter',
      gffLocation: {
        locationType: 'FileHandleLocation',
        handleId: 'fh123',
        name: 'test.gff3',
      },
    }
    const blobConfig = {
      type: 'Gff3Adapter',
      gffLocation: {
        locationType: 'BlobLocation',
        blobId: 'fh-blob-fh123',
        name: 'test.gff3',
      },
    }
    expect(idMaker(fileHandleConfig)).toBe(idMaker(blobConfig))
  })

  test('produces consistent hash for same config', () => {
    const config = {
      type: 'BamAdapter',
      bamLocation: { locationType: 'UriLocation', uri: 'test.bam' },
    }
    expect(idMaker(config)).toBe(idMaker(config))
    expect(idMaker({ ...config })).toBe(idMaker(config))
  })

  test('produces different hash for different configs', () => {
    const config1 = {
      type: 'BamAdapter',
      bamLocation: { locationType: 'UriLocation', uri: 'test1.bam' },
    }
    const config2 = {
      type: 'BamAdapter',
      bamLocation: { locationType: 'UriLocation', uri: 'test2.bam' },
    }
    expect(idMaker(config1)).not.toBe(idMaker(config2))
  })

  test('arrays of different lengths sharing a long tail get different ids', () => {
    const tail = Array.from({ length: 200 }, (_, i) => ({
      uniqueId: `f${i}`,
      refName: 'chr1',
      start: i * 100,
      end: i * 100 + 50,
    }))
    const head = { uniqueId: 'extra', refName: 'chr1', start: 0, end: 1 }
    expect(idMaker({ type: 'FromConfigAdapter', features: tail })).not.toBe(
      idMaker({ type: 'FromConfigAdapter', features: [head, ...tail] }),
    )
  })

  test('withAdapterId tells apart same-length configs differing past the budget', () => {
    const tail = Array.from({ length: 200 }, (_, i) => ({
      uniqueId: `f${i}`,
      refName: 'chr1',
      start: i * 100,
      end: i * 100 + 50,
    }))
    const a = {
      type: 'FromConfigAdapter',
      features: [{ uniqueId: 'a' }, ...tail],
    }
    const b = {
      type: 'FromConfigAdapter',
      features: [{ uniqueId: 'b' }, ...tail],
    }
    expect(adapterConfigCacheKey(a)).toBe(adapterConfigCacheKey(b))
    expect(adapterConfigCacheKey(withAdapterId(a))).not.toBe(
      adapterConfigCacheKey(withAdapterId(b)),
    )
  })

  test('handles nested FileHandleLocation', () => {
    const fileHandleConfig = {
      type: 'SomeAdapter',
      nested: {
        deep: {
          location: {
            locationType: 'FileHandleLocation',
            handleId: 'fh456',
            name: 'nested.vcf',
          },
        },
      },
    }
    const blobConfig = {
      type: 'SomeAdapter',
      nested: {
        deep: {
          location: {
            locationType: 'BlobLocation',
            blobId: 'fh-blob-fh456',
            name: 'nested.vcf',
          },
        },
      },
    }
    expect(idMaker(fileHandleConfig)).toBe(idMaker(blobConfig))
  })
})
