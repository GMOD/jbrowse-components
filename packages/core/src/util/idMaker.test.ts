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
