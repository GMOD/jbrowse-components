import {
  getAssemblyNames,
  getTrackConfigs,
  parseCommaSeparatedString,
} from './config-utils.ts'

import type { Assembly, Config } from '../../base.ts'

describe('parseCommaSeparatedString', () => {
  test('returns empty array for undefined', () => {
    expect(parseCommaSeparatedString(undefined)).toEqual([])
  })

  test('returns empty array for empty string', () => {
    expect(parseCommaSeparatedString('')).toEqual([])
  })

  test('parses comma-separated values', () => {
    expect(parseCommaSeparatedString('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  test('trims whitespace', () => {
    expect(parseCommaSeparatedString(' a , b , c ')).toEqual(['a', 'b', 'c'])
  })
})

jest.spyOn(console, 'log').mockImplementation(() => {})

describe('getTrackConfigs', () => {
  const mockConfig: Config = {
    assemblies: [{ name: 'test_assembly' } as Assembly],
    tracks: [
      {
        trackId: 'gff3_track',
        name: 'GFF3 Track',
        assemblyNames: ['test_assembly'],
        adapter: {
          type: 'Gff3TabixAdapter',
          gffGzLocation: { uri: 'test.gff3.gz' },
        },
      },
      {
        trackId: 'vcf_track',
        name: 'VCF Track',
        assemblyNames: ['test_assembly'],
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: { uri: 'test.vcf.gz' },
        },
      },
      {
        trackId: 'bam_track',
        name: 'BAM Track',
        assemblyNames: ['test_assembly'],
        adapter: { type: 'BamAdapter', bamLocation: { uri: 'test.bam' } },
      },
      {
        trackId: 'other_assembly_track',
        name: 'Other Assembly Track',
        assemblyNames: ['other_assembly'],
        adapter: {
          type: 'Gff3TabixAdapter',
          gffGzLocation: { uri: 'other.gff3.gz' },
        },
      },
    ],
  }

  test('returns all supported tracks when trackIds is undefined', () => {
    const tracks = getTrackConfigs(mockConfig, undefined, 'test_assembly')
    expect(tracks.map(t => t.trackId)).toEqual(['gff3_track', 'vcf_track'])
  })

  test('returns all supported tracks when trackIds is empty array', () => {
    const tracks = getTrackConfigs(mockConfig, [], 'test_assembly')
    expect(tracks.map(t => t.trackId)).toEqual(['gff3_track', 'vcf_track'])
  })

  test('returns specific tracks when trackIds provided', () => {
    const tracks = getTrackConfigs(mockConfig, ['gff3_track'], 'test_assembly')
    expect(tracks.map(t => t.trackId)).toEqual(['gff3_track'])
  })

  test('filters by assembly name', () => {
    const tracks = getTrackConfigs(mockConfig, undefined, 'other_assembly')
    expect(tracks.map(t => t.trackId)).toEqual(['other_assembly_track'])
  })

  test('excludes tracks via excludeTrackIds', () => {
    const tracks = getTrackConfigs(mockConfig, undefined, 'test_assembly', [
      'gff3_track',
    ])
    expect(tracks.map(t => t.trackId)).toEqual(['vcf_track'])
  })

  test('returns empty array when no tracks in config', () => {
    const emptyConfig: Config = { assemblies: [] }
    const tracks = getTrackConfigs(emptyConfig, undefined, 'test_assembly')
    expect(tracks).toEqual([])
  })

  test('filters out unsupported adapter types', () => {
    const tracks = getTrackConfigs(mockConfig, undefined, 'test_assembly')
    expect(tracks.every(t => t.adapter?.type !== 'BamAdapter')).toBe(true)
  })
})

describe('getAssemblyNames', () => {
  test('extracts assembly names from config.assemblies', () => {
    const config: Config = {
      assemblies: [{ name: 'asm1' } as Assembly, { name: 'asm2' } as Assembly],
    }
    expect(getAssemblyNames(config)).toEqual(['asm1', 'asm2'])
  })

  test('extracts assembly name from config.assembly (single)', () => {
    const config: Config = {
      assembly: { name: 'single_asm' } as Config['assembly'],
    }
    expect(getAssemblyNames(config)).toEqual(['single_asm'])
  })

  test('uses provided assemblies string over config', () => {
    const config: Config = {
      assemblies: [{ name: 'asm1' } as Assembly],
    }
    expect(getAssemblyNames(config, 'custom1,custom2')).toEqual([
      'custom1',
      'custom2',
    ])
  })

  test('throws when no assemblies found', () => {
    const config: Config = {}
    expect(() => getAssemblyNames(config)).toThrow('No assemblies found')
  })
})
