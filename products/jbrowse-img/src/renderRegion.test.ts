import fs from 'fs'
import os from 'os'
import path from 'path'

import { standardizeArgv } from './parseArgv.ts'
import { makeLocation, makeTrackConfig, readData } from './readData.ts'
import { booleanize } from './util.ts'

const dataDir = path.join(__dirname, '..', 'data')
const configFile = path.join(dataDir, 'config.json')
const assemblyFile = path.join(dataDir, 'assembly.json')

const fakeAssembly = {
  name: 'testAsm',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'refseq',
    adapter: { type: 'IndexedFastaAdapter' },
  },
}

describe('booleanize', () => {
  test('false string returns false', () => {
    expect(booleanize('false')).toBe(false)
  })

  test('non-empty string returns true', () => {
    expect(booleanize('true')).toBe(true)
    expect(booleanize('1')).toBe(true)
    expect(booleanize('yes')).toBe(true)
  })

  test('empty string returns false', () => {
    expect(booleanize('')).toBe(false)
  })
})

describe('standardizeArgv', () => {
  const trackTypes = [
    'bam',
    'cram',
    'bigwig',
    'vcfgz',
    'gffgz',
    'hic',
    'bigbed',
    'bedgz',
  ]

  test('separates track types from other options', () => {
    const args: [string, string[]][] = [
      ['bam', ['reads.bam']],
      ['out', ['out.svg']],
      ['loc', ['chr1:1-1000']],
    ]
    const result = standardizeArgv(args, trackTypes)
    expect(result.trackList).toEqual([['bam', ['reads.bam']]])
    expect(result.out).toBe('out.svg')
    expect(result.loc).toBe('chr1:1-1000')
  })

  test('multiple tracks of same type all go into trackList', () => {
    const args: [string, string[]][] = [
      ['bam', ['dad.bam']],
      ['bam', ['mom.bam']],
    ]
    const result = standardizeArgv(args, trackTypes)
    expect(result.trackList).toHaveLength(2)
  })

  test('boolean flags (no values) become true', () => {
    const args: [string, string[]][] = [['noRasterize', []]]
    const result = standardizeArgv(args, trackTypes)
    expect(result.noRasterize).toBe(true)
  })
})

describe('makeLocation', () => {
  test('http/https/ftp/s3 schemes become uri locations', () => {
    expect(makeLocation('https://example.com/a.bw')).toEqual({
      uri: 'https://example.com/a.bw',
    })
    expect(makeLocation('https://example.com/a.bw')).toEqual({
      uri: 'https://example.com/a.bw',
    })
    expect(makeLocation('ftp://example.com/a.bw')).toEqual({
      uri: 'ftp://example.com/a.bw',
    })
    expect(makeLocation('s3://bucket/a.bw')).toEqual({
      uri: 's3://bucket/a.bw',
    })
  })

  test('local paths become localPath locations', () => {
    expect(makeLocation('/data/a.bw')).toEqual({ localPath: '/data/a.bw' })
    expect(makeLocation('./a.bw')).toEqual({ localPath: './a.bw' })
    expect(makeLocation(String.raw`C:\data\a.bw`)).toEqual({
      localPath: String.raw`C:\data\a.bw`,
    })
  })
})

describe('makeTrackConfig', () => {
  test('bam track', () => {
    const config = makeTrackConfig('bam', 'reads.bam', undefined, fakeAssembly)
    expect(config).toMatchObject({
      type: 'AlignmentsTrack',
      trackId: 'reads.bam',
      name: 'reads.bam',
      assemblyNames: ['testAsm'],
      adapter: {
        type: 'BamAdapter',
        bamLocation: { localPath: 'reads.bam' },
        index: { location: { localPath: 'reads.bam.bai' }, indexType: 'BAI' },
      },
    })
  })

  test('bam track with explicit CSI index', () => {
    const config = makeTrackConfig(
      'bam',
      'reads.bam',
      'reads.bam.csi',
      fakeAssembly,
    )
    expect(config?.adapter).toMatchObject({
      index: { indexType: 'CSI' },
    })
  })

  test('cram track', () => {
    const config = makeTrackConfig(
      'cram',
      'reads.cram',
      undefined,
      fakeAssembly,
    )
    expect(config).toMatchObject({
      type: 'AlignmentsTrack',
      adapter: {
        type: 'CramAdapter',
        craiLocation: { localPath: 'reads.cram.crai' },
      },
    })
  })

  test('bigwig track', () => {
    const config = makeTrackConfig(
      'bigwig',
      'signal.bw',
      undefined,
      fakeAssembly,
    )
    expect(config).toMatchObject({
      type: 'QuantitativeTrack',
      adapter: {
        type: 'BigWigAdapter',
        bigWigLocation: { localPath: 'signal.bw' },
      },
    })
  })

  test('vcfgz track with default tbi index', () => {
    const config = makeTrackConfig(
      'vcfgz',
      'variants.vcf.gz',
      undefined,
      fakeAssembly,
    )
    expect(config).toMatchObject({
      type: 'VariantTrack',
      adapter: {
        type: 'VcfTabixAdapter',
        index: {
          indexType: 'TBI',
          location: { localPath: 'variants.vcf.gz.tbi' },
        },
      },
    })
  })

  test('vcfgz track with explicit CSI index', () => {
    const config = makeTrackConfig(
      'vcfgz',
      'variants.vcf.gz',
      'variants.vcf.gz.csi',
      fakeAssembly,
    )
    expect(config?.adapter).toMatchObject({ index: { indexType: 'CSI' } })
  })

  test('gffgz track', () => {
    const config = makeTrackConfig(
      'gffgz',
      'genes.gff.gz',
      undefined,
      fakeAssembly,
    )
    expect(config).toMatchObject({
      type: 'FeatureTrack',
      adapter: { type: 'Gff3TabixAdapter' },
    })
  })

  test('hic track', () => {
    const config = makeTrackConfig('hic', 'matrix.hic', undefined, fakeAssembly)
    expect(config).toMatchObject({
      type: 'HicTrack',
      adapter: { type: 'HicAdapter' },
    })
  })

  test('bigbed track', () => {
    const config = makeTrackConfig(
      'bigbed',
      'features.bb',
      undefined,
      fakeAssembly,
    )
    expect(config).toMatchObject({
      type: 'FeatureTrack',
      adapter: { type: 'BigBedAdapter' },
    })
  })

  test('bedgz track', () => {
    const config = makeTrackConfig(
      'bedgz',
      'regions.bed.gz',
      undefined,
      fakeAssembly,
    )
    expect(config).toMatchObject({
      type: 'FeatureTrack',
      adapter: { type: 'BedTabixAdapter' },
    })
  })

  test('unknown track type returns undefined', () => {
    const config = makeTrackConfig(
      'unknown',
      'file.txt',
      undefined,
      fakeAssembly,
    )
    expect(config).toBeUndefined()
  })

  test('http URI tracks use uri location', () => {
    const config = makeTrackConfig(
      'bigwig',
      'https://example.com/signal.bw',
      undefined,
      fakeAssembly,
    )
    expect(config?.adapter).toMatchObject({
      bigWigLocation: { uri: 'https://example.com/signal.bw' },
    })
  })
})

describe('readData', () => {
  test('throws with no assembly', () => {
    expect(() => readData({})).toThrow(/no assembly specified/)
  })

  test('builds assembly from fasta option', () => {
    const result = readData({ fasta: '/path/to/ref.fa' })
    expect(result.assembly.name).toBe('ref.fa')
    expect(result.assembly.sequence).toMatchObject({
      adapter: { type: 'IndexedFastaAdapter' },
    })
  })

  test('builds bgzip assembly when fasta ends with gz', () => {
    const result = readData({ fasta: '/path/to/ref.fa.gz' })
    expect(result.assembly.sequence).toMatchObject({
      adapter: { type: 'BgzipFastaAdapter' },
    })
  })

  test('adds tracks from trackList', () => {
    const result = readData({
      fasta: '/path/to/ref.fa',
      trackList: [['bam', ['reads.bam']]],
    })
    expect(result.tracks).toHaveLength(1)
    expect(result.tracks[0]).toMatchObject({ type: 'AlignmentsTrack' })
  })

  test('multiple tracks accumulate', () => {
    const result = readData({
      fasta: '/path/to/ref.fa',
      trackList: [
        ['bam', ['reads1.bam']],
        ['bigwig', ['signal.bw']],
      ],
    })
    expect(result.tracks).toHaveLength(2)
  })

  test('throws when track has no file', () => {
    expect(() =>
      readData({
        fasta: '/path/to/ref.fa',
        trackList: [['bam', []]],
      }),
    ).toThrow(/no file specified/)
  })

  test('reads assembly by name from config file', () => {
    const result = readData({ config: configFile, assembly: 'GRCh38' })
    expect(result.assembly.name).toBe('GRCh38')
  })

  test('defaults to first assembly when no assembly name given', () => {
    const result = readData({ config: configFile })
    expect(result.assembly).toBeDefined()
  })

  test('throws when named assembly not found in config', () => {
    expect(() =>
      readData({ config: configFile, assembly: 'nonexistent' }),
    ).toThrow(/assembly nonexistent not found in config/)
  })

  test('reads assembly from assembly JSON file', () => {
    const result = readData({ assembly: assemblyFile })
    expect(result.assembly.name).toBe('GRCh38')
  })

  test('clears defaultSession from config by default', () => {
    const result = readData({ config: configFile })
    expect(result.defaultSession).toBeUndefined()
  })

  test('loads tracks from tracks JSON file', () => {
    const tracksFile = path.join(dataDir, 'tracks.json')
    const result = readData({ config: configFile, tracks: tracksFile })
    expect(Array.isArray(result.tracks)).toBe(true)
    expect(result.tracks.length).toBeGreaterThan(0)
  })

  test('throws when tracks file is not a JSON array', () => {
    const assemblyAsTrack = assemblyFile
    expect(() =>
      readData({ config: configFile, tracks: assemblyAsTrack }),
    ).toThrow(/expected a JSON array of tracks/)
  })

  test('resolves localPath in a tracks file relative to that file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jbimg-'))
    const tracksFile = path.join(dir, 'tracks.json')
    fs.writeFileSync(
      tracksFile,
      JSON.stringify([
        {
          type: 'FeatureTrack',
          trackId: 'local',
          adapter: {
            type: 'BigBedAdapter',
            bigBedLocation: { localPath: 'sub/features.bb' },
          },
        },
      ]),
    )
    const result = readData({ fasta: '/ref.fa', tracks: tracksFile })
    const adapter = result.tracks[0]!.adapter as {
      bigBedLocation: { localPath: string }
    }
    expect(adapter.bigBedLocation.localPath).toBe(
      path.join(dir, 'sub/features.bb'),
    )
  })
})
