import { detectFileType, getFileSourceName } from './ImportWizard.ts'

import type { FileLocation } from '@jbrowse/core/util'

describe('detectFileType', () => {
  test('detects VCF extensions', () => {
    expect(detectFileType('foo.vcf')).toBe('VCF')
    expect(detectFileType('foo.vcf.gz')).toBe('VCF')
    expect(detectFileType('foo.VCF.GZ')).toBe('VCF')
  })

  test('detects BED extensions', () => {
    expect(detectFileType('foo.bed')).toBe('BED')
    expect(detectFileType('foo.bed.gz')).toBe('BED')
  })

  test('detects BEDPE', () => {
    expect(detectFileType('foo.bedpe')).toBe('BEDPE')
    expect(detectFileType('foo.bedpe.gz')).toBe('BEDPE')
  })

  test('detects STAR-Fusion', () => {
    expect(detectFileType('foo.star-fusion')).toBe('STAR-Fusion')
  })

  test('returns undefined for unrecognized extensions', () => {
    expect(detectFileType('foo.bam')).toBeUndefined()
    expect(detectFileType('foo.txt')).toBeUndefined()
  })
})

describe('getFileSourceName', () => {
  test('returns uri for UriLocation', () => {
    const loc = {
      uri: 'https://example.com/file.vcf',
      locationType: 'UriLocation',
    } as FileLocation
    expect(getFileSourceName(loc)).toBe('https://example.com/file.vcf')
  })

  test('returns localPath for LocalPathLocation', () => {
    const loc = {
      localPath: '/path/to/file.vcf',
      locationType: 'LocalPathLocation',
    } as FileLocation
    expect(getFileSourceName(loc)).toBe('/path/to/file.vcf')
  })
})
