import {
  findFileHandleIds,
  getFileName,
  getTrackName,
  stripFileExtension,
} from './tracks.ts'

describe('findFileHandleIds', () => {
  test('finds FileHandleLocation in flat object', () => {
    const obj = {
      location: {
        locationType: 'FileHandleLocation',
        handleId: 'fh123',
        name: 'test.bam',
      },
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(1)
    expect(result.has('fh123')).toBe(true)
  })

  test('finds multiple FileHandleLocations', () => {
    const obj = {
      fileLocation: {
        locationType: 'FileHandleLocation',
        handleId: 'fh1',
        name: 'test.bam',
      },
      indexLocation: {
        locationType: 'FileHandleLocation',
        handleId: 'fh2',
        name: 'test.bam.bai',
      },
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(2)
    expect(result.has('fh1')).toBe(true)
    expect(result.has('fh2')).toBe(true)
  })

  test('finds FileHandleLocation in nested object', () => {
    const obj = {
      adapter: {
        type: 'BamAdapter',
        bamLocation: {
          locationType: 'FileHandleLocation',
          handleId: 'fh-nested',
          name: 'nested.bam',
        },
      },
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(1)
    expect(result.has('fh-nested')).toBe(true)
  })

  test('finds FileHandleLocation in arrays', () => {
    const obj = {
      tracks: [
        {
          adapter: {
            fileLocation: {
              locationType: 'FileHandleLocation',
              handleId: 'fh-arr-1',
              name: 'file1.vcf',
            },
          },
        },
        {
          adapter: {
            fileLocation: {
              locationType: 'FileHandleLocation',
              handleId: 'fh-arr-2',
              name: 'file2.vcf',
            },
          },
        },
      ],
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(2)
    expect(result.has('fh-arr-1')).toBe(true)
    expect(result.has('fh-arr-2')).toBe(true)
  })

  test('ignores non-FileHandleLocation objects', () => {
    const obj = {
      uriLocation: {
        locationType: 'UriLocation',
        uri: 'https://example.com/file.bam',
      },
      blobLocation: {
        locationType: 'BlobLocation',
        blobId: 'blob123',
        name: 'local.bam',
      },
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(0)
  })

  test('handles circular references without infinite loop', () => {
    const obj: Record<string, unknown> = {
      location: {
        locationType: 'FileHandleLocation',
        handleId: 'fh-circular',
        name: 'circular.bam',
      },
    }
    obj.self = obj

    const result = findFileHandleIds(obj)
    expect(result.size).toBe(1)
    expect(result.has('fh-circular')).toBe(true)
  })

  test('handles deeply nested circular references', () => {
    const inner: Record<string, unknown> = {
      location: {
        locationType: 'FileHandleLocation',
        handleId: 'fh-deep',
        name: 'deep.bam',
      },
    }
    const obj = {
      level1: {
        level2: inner,
      },
    }
    inner.backRef = obj

    const result = findFileHandleIds(obj)
    expect(result.size).toBe(1)
    expect(result.has('fh-deep')).toBe(true)
  })

  test('returns empty set for null/undefined', () => {
    expect(findFileHandleIds(null).size).toBe(0)
    expect(findFileHandleIds(undefined).size).toBe(0)
  })

  test('returns empty set for primitives', () => {
    expect(findFileHandleIds('string').size).toBe(0)
    expect(findFileHandleIds(123).size).toBe(0)
    expect(findFileHandleIds(true).size).toBe(0)
  })

  test('deduplicates same handleId appearing multiple times', () => {
    const sharedLocation = {
      locationType: 'FileHandleLocation',
      handleId: 'fh-shared',
      name: 'shared.bam',
    }
    const obj = {
      loc1: sharedLocation,
      loc2: sharedLocation,
      nested: { loc3: sharedLocation },
    }
    const result = findFileHandleIds(obj)
    expect(result.size).toBe(1)
    expect(result.has('fh-shared')).toBe(true)
  })
})

describe('getFileName', () => {
  test('returns name from BlobLocation', () => {
    const loc = {
      locationType: 'BlobLocation' as const,
      blobId: 'b123',
      name: 'test.bam',
    }
    expect(getFileName(loc)).toBe('test.bam')
  })

  test('returns name from FileHandleLocation', () => {
    const loc = {
      locationType: 'FileHandleLocation' as const,
      handleId: 'fh123',
      name: 'handle.bam',
    }
    expect(getFileName(loc)).toBe('handle.bam')
  })

  test('extracts filename from UriLocation', () => {
    const loc = {
      locationType: 'UriLocation' as const,
      uri: 'https://example.com/path/to/file.bam',
    }
    expect(getFileName(loc)).toBe('file.bam')
  })

  test('handles Windows backslashes in URI', () => {
    const loc = {
      locationType: 'UriLocation' as const,
      uri: String.raw`file://C:\Users\test\file.bam`,
    }
    expect(getFileName(loc)).toBe('file.bam')
  })

  test('extracts filename from LocalPathLocation', () => {
    const loc = {
      locationType: 'LocalPathLocation' as const,
      localPath: '/home/user/data.vcf',
    }
    expect(getFileName(loc)).toBe('data.vcf')
  })

  test('handles Windows paths in LocalPathLocation', () => {
    const loc = {
      locationType: 'LocalPathLocation' as const,
      localPath: String.raw`C:\Users\test\data.vcf`,
    }
    expect(getFileName(loc)).toBe('data.vcf')
  })

  test('returns empty string for unknown location type', () => {
    const loc = { locationType: 'UnknownLocation' } as any
    expect(getFileName(loc)).toBe('')
  })
})

describe('getTrackName', () => {
  const session = { assemblies: [] }

  test('returns the name when set', () => {
    const conf = { name: 'My track', type: 'FeatureTrack', trackId: 'genes' }
    expect(getTrackName(conf, session)).toBe('My track')
  })

  test('falls back to trackId when name is empty', () => {
    const conf = { name: '', type: 'FeatureTrack', trackId: 'genes' }
    expect(getTrackName(conf, session)).toBe('genes')
  })

  test('falls back to trackId when name is unset', () => {
    const conf = { type: 'FeatureTrack', trackId: 'genes' }
    expect(getTrackName(conf, session)).toBe('genes')
  })

  test('returns empty string when neither name nor trackId set', () => {
    const conf = { type: 'FeatureTrack' }
    expect(getTrackName(conf, session)).toBe('')
  })

  test('uses generic reference sequence label when no assembly matches', () => {
    const conf = { type: 'ReferenceSequenceTrack', trackId: 'hg38-ref' }
    expect(getTrackName(conf, session)).toBe('Reference sequence')
  })
})

describe('stripFileExtension', () => {
  test('drops a plain extension', () => {
    expect(stripFileExtension('volvox-sorted.bam')).toBe('volvox-sorted')
  })

  test('drops the format extension along with a compression suffix', () => {
    expect(stripFileExtension('volvox.vcf.gz')).toBe('volvox')
    expect(stripFileExtension('volvox.gff3.bgz')).toBe('volvox')
  })

  test('keeps interior dots that are part of the name', () => {
    expect(stripFileExtension('volvox.sorted.bam')).toBe('volvox.sorted')
  })

  test('is case insensitive about the compression suffix', () => {
    expect(stripFileExtension('volvox.VCF.GZ')).toBe('volvox')
  })

  test('leaves a name with no extension alone', () => {
    expect(stripFileExtension('volvox')).toBe('volvox')
  })

  test('leaves a dotfile alone', () => {
    expect(stripFileExtension('.bam')).toBe('.bam')
  })

  test('handles a bare compression suffix', () => {
    expect(stripFileExtension('volvox.gz')).toBe('volvox')
  })
})
