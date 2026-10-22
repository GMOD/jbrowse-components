import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { parseArgv, standardizeArgv } from '@jbrowse/launch-args'

import { syntenyTrackTypes, trackTypes } from './makeConfigs.ts'
import { readData } from './readData.ts'
import { renderRegion, resolveMode } from './renderRegion.ts'

const dataDir = path.join(__dirname, '..', 'data')
const configFile = path.join(dataDir, 'config.json')
const assemblyFile = path.join(dataDir, 'assembly.json')

describe('standardizeArgv', () => {
  const trackTypes = [
    'bam',
    'cram',
    'bigwig',
    'vcf',
    'gff',
    'hic',
    'bigbed',
    'bed',
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

  test('bare files: a genome file is the assembly, the rest are tracks', () => {
    const result = readData({
      trackList: [
        ['file', ['reads.bam', 'name:Reads']],
        ['file', ['/path/to/ref.fa', 'aliases:aliases.txt']],
        ['file', ['calls.vcf.gz']],
      ],
    })
    expect(result.assembly).toMatchObject({
      name: 'ref.fa',
      sequence: { adapter: { type: 'IndexedFastaAdapter' } },
      refNameAliases: { adapter: { type: 'RefNameAliasAdapter' } },
    })
    expect(result.tracks.map(t => [t.type, t.name])).toEqual([
      ['AlignmentsTrack', 'Reads'],
      ['VariantTrack', 'calls.vcf.gz'],
    ])
    expect(result.openTracks).toEqual([
      { trackId: 'reads.bam', opts: ['name:Reads'] },
      { trackId: 'calls.vcf.gz', opts: [] },
    ])
  })

  test('bare genome and comparison files stack a comparative view', () => {
    const argv = parseArgv('a.fa loc:I a_b.paf b.fa reads.bam'.split(' '))
    const { trackList } = standardizeArgv(argv, [
      ...trackTypes,
      ...syntenyTrackTypes,
    ])
    const result = readData({ argv, trackList })
    expect(result.assemblies.map(a => a.name)).toEqual(['a.fa', 'b.fa'])
    expect(result.assemblyLocs).toEqual(['I', undefined])
    expect(result.tracks.map(t => [t.type, t.assemblyNames])).toEqual([
      ['SyntenyTrack', ['a.fa', 'b.fa']],
      ['AlignmentsTrack', ['a.fa']],
    ])
  })

  test('a bare genome file beside --fasta is a second genome, refused', () => {
    expect(() =>
      readData({
        fasta: '/path/to/ref.fa',
        trackList: [['file', ['other.fa']]],
      }),
    ).toThrow(/other\.fa is a genome/)
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
    ).toThrow(/--bam requires a file argument/)
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

  test('a genome file beside a config is refused', () => {
    expect(() => readData({ config: configFile, fasta: '/ref.fa' })).toThrow(
      /ref\.fa is a genome, and the config/,
    )
  })

  test('--fasta keeps its aliases: modifier', () => {
    const result = readData({
      fasta: '/ref.fa',
      argv: [['fasta', ['/ref.fa', 'aliases:a.txt']]],
    })
    expect(result.assembly.refNameAliases).toMatchObject({
      adapter: { location: { localPath: 'a.txt' } },
    })
  })

  test('a modifier the genome has no use for throws', () => {
    expect(() =>
      readData({ trackList: [['file', ['/ref.fa', 'height:100']]] }),
    ).toThrow(/takes aliases: and cytobands:, not height:100/)
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
  test('one alignment file on two synteny levels is two tracks with two ids', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = readData({
      argv: [
        ['fasta', ['/a.fa']],
        ['paf', ['/aln.paf']],
        ['fasta', ['/b.fa']],
        ['paf', ['/aln.paf']],
        ['fasta', ['/c.fa']],
      ],
    })
    const synteny = result.tracks.filter(t => t.type === 'SyntenyTrack')
    expect(synteny.map(t => t.trackId)).toEqual(['aln.paf', 'aln.paf-2'])
    expect(synteny.map(t => t.assemblyNames)).toEqual([
      ['a.fa', 'b.fa'],
      ['b.fa', 'c.fa'],
    ])
    warn.mockRestore()
  })

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

describe('resolveMode', () => {
  it('defaults to linear with neither a subcommand nor a spec', () => {
    expect(resolveMode(undefined, undefined)).toBe('linear')
  })

  it('reads the mode off the spec when no subcommand was typed', () => {
    expect(resolveMode(undefined, { type: 'DotplotView' })).toBe('dotplot')
  })

  it('accepts a subcommand that agrees with the spec', () => {
    expect(resolveMode('synteny', { type: 'LinearSyntenyView' })).toBe(
      'synteny',
    )
  })

  it('names both subcommands when they disagree', () => {
    expect(() => resolveMode('dotplot', { type: 'LinearSyntenyView' })).toThrow(
      '--spec describes a LinearSyntenyView; render it with "jb2export synteny" (not "jb2export dotplot")',
    )
  })

  it('refuses a spec on lgv rather than rendering an empty linear view', () => {
    expect(() => resolveMode('linear', { type: 'DotplotView' })).toThrow(
      /render it with "jb2export dotplot" \(not "jb2export lgv"\)/,
    )
    expect(() => resolveMode('linear', { type: 'LinearGenomeView' })).toThrow(
      /unsupported view type in --spec: LinearGenomeView/,
    )
  })
})

// the mismatch is decided before the model is built, so this costs no render
test('a mismatched --spec fails the run', async () => {
  await expect(
    renderRegion({
      fasta: '/path/to/ref.fa',
      mode: 'dotplot',
      spec: JSON.stringify({ type: 'LinearSyntenyView' }),
    }),
  ).rejects.toThrow(/render it with "jb2export synteny"/)
})
