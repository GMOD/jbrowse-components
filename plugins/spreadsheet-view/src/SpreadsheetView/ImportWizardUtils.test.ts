import {
  detectFileType,
  getFileSourceName,
  sniffFileType,
} from './ImportWizard.ts'

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
    expect(detectFileType('K562.star-fusion.tsv')).toBe('STAR-Fusion')
    expect(detectFileType('star-fusion.fusion_predictions.abridged.tsv')).toBe(
      'STAR-Fusion',
    )
    expect(detectFileType('https://x/y/StarFusion_out.tsv?sig=1')).toBe(
      'STAR-Fusion',
    )
  })

  test('an extension the list knows wins over a STAR-Fusion-looking name', () => {
    expect(detectFileType('fusion_predictions.bedpe')).toBe('BEDPE')
  })

  test('returns undefined for unrecognized extensions', () => {
    expect(detectFileType('foo.bam')).toBeUndefined()
    expect(detectFileType('foo.txt')).toBeUndefined()
  })

  // Regression: the extension is anchored to the end of the string, so a
  // presigned URL detected as nothing and silently kept the VCF default
  test('looks past a query string or fragment', () => {
    expect(detectFileType('https://x.test/calls.bed?X-Amz-Signature=abc')).toBe(
      'BED',
    )
    expect(detectFileType('https://x.test/calls.bedpe.gz?a=1&b=2')).toBe(
      'BEDPE',
    )
    expect(detectFileType('https://x.test/calls.vcf.gz#frag')).toBe('VCF')
    expect(detectFileType('https://x.test/calls.bam?a=.bed')).toBeUndefined()
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

describe('sniffFileType', () => {
  const enc = (s: string) => new TextEncoder().encode(s)

  test('reads a STAR-Fusion header off the first line', () => {
    expect(
      sniffFileType(enc('#FusionName\tJunctionReadCount\tLeftBreakpoint\n')),
    ).toBe('STAR-Fusion')
    expect(sniffFileType(enc('FusionName\tLeftBreakpoint\nA--B\t...'))).toBe(
      'STAR-Fusion',
    )
  })

  test('says nothing about a file it does not recognise', () => {
    expect(sniffFileType(enc('##fileformat=VCFv4.2\n#CHROM\tPOS\n'))).toBe(
      undefined,
    )
    expect(sniffFileType(enc('chr1\t100\t200\n'))).toBe(undefined)
    expect(sniffFileType(enc(''))).toBe(undefined)
  })
})
