import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { makeLocation, makeTrackConfig } from './makeConfigs.ts'
import { standardizeArgv } from './parseArgv.ts'
import { readData } from './readData.ts'

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

  // `name:` used to be honored only by --multiwig, so `--bam reads.bam
  // name:"My reads"` silently kept the filename as the track label.
  test('an explicit name overrides the filename label', () => {
    const config = makeTrackConfig(
      'bam',
      'reads.bam',
      undefined,
      fakeAssembly,
      'My reads',
    )
    expect(config).toMatchObject({ trackId: 'reads.bam', name: 'My reads' })
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

  describe('a local file indexed only with .csi', () => {
    // htslib writes .csi rather than .tbi/.bai for a reference over 512 Mb, and
    // on request at any size. Those files used to need an explicit `index:` and
    // otherwise failed on a sibling they never had.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-csi-'))
    const vcf = path.join(dir, 'variants.vcf.gz')
    const bam = path.join(dir, 'reads.bam')
    beforeAll(() => {
      fs.writeFileSync(vcf, '')
      fs.writeFileSync(`${vcf}.csi`, '')
      fs.writeFileSync(bam, '')
      fs.writeFileSync(`${bam}.csi`, '')
    })
    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true })
    })

    test('a tabix track finds it, and opens it as CSI', () => {
      expect(
        makeTrackConfig('vcfgz', vcf, undefined, fakeAssembly)?.adapter,
      ).toMatchObject({
        index: { indexType: 'CSI', location: { localPath: `${vcf}.csi` } },
      })
    })

    test('a bam track finds it too', () => {
      expect(
        makeTrackConfig('bam', bam, undefined, fakeAssembly)?.adapter,
      ).toMatchObject({
        index: { indexType: 'CSI', location: { localPath: `${bam}.csi` } },
      })
    })

    test('the conventional sibling still wins when it is there', () => {
      fs.writeFileSync(`${vcf}.tbi`, '')
      try {
        expect(
          makeTrackConfig('vcfgz', vcf, undefined, fakeAssembly)?.adapter,
        ).toMatchObject({ index: { indexType: 'TBI' } })
      } finally {
        fs.rmSync(`${vcf}.tbi`)
      }
    })
  })

  test('a bam finds the Picard/GATK "reads.bai" spelling', () => {
    // samtools writes reads.bam.bai; Picard and GATK write reads.bai
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-bai-'))
    const bam = path.join(dir, 'reads.bam')
    fs.writeFileSync(bam, '')
    fs.writeFileSync(path.join(dir, 'reads.bai'), '')
    try {
      expect(
        makeTrackConfig('bam', bam, undefined, fakeAssembly)?.adapter,
      ).toMatchObject({
        index: {
          indexType: 'BAI',
          location: { localPath: path.join(dir, 'reads.bai') },
        },
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a non-bam is never opened as its own index', () => {
    // the stripped-extension guess is guarded on the extension matching; without
    // that, `file.replace(/\.bam$/, '.bai')` returns the data file itself, which
    // exists, and would be handed over as the index
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-self-'))
    const data = path.join(dir, 'reads.sam')
    fs.writeFileSync(data, '')
    try {
      expect(
        makeTrackConfig('bam', data, undefined, fakeAssembly)?.adapter,
      ).toMatchObject({
        index: { location: { localPath: `${data}.bai` } },
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a remote file keeps the conventional sibling, unprobed', () => {
    // A URL cannot be checked without a request, and this builder is
    // synchronous, so a remote .csi still wants an explicit `index:`.
    expect(
      makeTrackConfig(
        'vcfgz',
        'https://example.com/variants.vcf.gz',
        undefined,
        fakeAssembly,
      )?.adapter,
    ).toMatchObject({
      index: {
        indexType: 'TBI',
        location: { uri: 'https://example.com/variants.vcf.gz.tbi' },
      },
    })
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

  // Track ids are file basenames, so `--bam tumor/sample.bam --bam
  // normal/sample.bam` produced two configs with one id: showTrack found the
  // first already open and handed it back, so only one file was ever drawn.
  test('two inputs sharing a basename get distinct trackIds', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = readData({
      fasta: '/ref.fa',
      trackList: [
        ['bam', ['tumor/sample.bam']],
        ['bam', ['normal/sample.bam']],
        ['bam', ['relapse/sample.bam']],
      ],
    })
    expect(result.tracks.map(t => t.trackId)).toEqual([
      'sample.bam',
      'sample.bam-2',
      'sample.bam-3',
    ])
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  // `path.basename` of a comma-separated --multiwig argument is the LAST entry
  // (or, with no directories in it, the whole comma string) — so a four-BigWig
  // track was named after one of its files, and two lists ending in the same
  // filename shared an id.
  test('a --multiwig list is not named after one of its files', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = readData({
      fasta: '/ref.fa',
      trackList: [
        ['multiwig', ['a/v1.bw,a/v2.bw']],
        ['multiwig', ['b/v1.bw,b/v2.bw', 'name:Cohort B']],
      ],
    })
    expect(result.tracks.map(t => t.trackId)).toEqual([
      'multiwig',
      'multiwig-2',
    ])
    // ...and `name:` is what tells the two panels apart, as for any other flag
    expect(result.tracks.map(t => t.name)).toEqual(['multiwig', 'Cohort B'])
    warn.mockRestore()
  })

  // A `.json` sources file, though, does have one filename to be named after.
  test('a --multiwig sources file keeps its own basename', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jbimg-'))
    const sources = path.join(dir, 'cohort.json')
    fs.writeFileSync(sources, JSON.stringify(['a.bw', 'b.bw']))
    const result = readData({
      fasta: '/ref.fa',
      trackList: [['multiwig', [sources]]],
    })
    expect(result.tracks.map(t => t.trackId)).toEqual(['cohort.json'])
  })

  test('a file basename colliding with a --tracks trackId is suffixed too', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jbimg-'))
    const tracksFile = path.join(dir, 'tracks.json')
    fs.writeFileSync(
      tracksFile,
      JSON.stringify([{ type: 'FeatureTrack', trackId: 'reads.bam' }]),
    )
    const result = readData({
      fasta: '/ref.fa',
      tracks: tracksFile,
      trackList: [['bam', ['a/reads.bam']]],
    })
    expect(result.tracks.map(t => t.trackId)).toEqual([
      'reads.bam',
      'reads.bam-2',
    ])
    expect(result.openTracks).toEqual([{ trackId: 'reads.bam-2', opts: [] }])
    warn.mockRestore()
  })

  // openTracks is what the renderer opens, so it must name the ids actually
  // assigned and carry each track's modifiers in argv order
  test('openTracks records the assigned id and the modifiers, in order', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = readData({
      fasta: '/ref.fa',
      trackList: [
        ['bam', ['a/sample.bam', 'height:200', 'color:strand']],
        ['bam', ['b/sample.bam']],
        ['bigwig', ['signal.bw', 'height:50']],
      ],
    })
    expect(result.openTracks).toEqual([
      { trackId: 'sample.bam', opts: ['height:200', 'color:strand'] },
      { trackId: 'sample.bam-2', opts: [] },
      { trackId: 'signal.bw', opts: ['height:50'] },
    ])
    warn.mockRestore()
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
