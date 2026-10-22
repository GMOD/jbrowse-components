import { launchPlan } from './launchPlan.ts'
import { parseArgv } from './parseArgv.ts'

const anyPlan = (line: string, cwd = '/work') =>
  launchPlan(parseArgv(line.split(' ')), cwd)

const plan = (line: string, cwd?: string) => {
  const p = anyPlan(line, cwd)
  if (p.type !== 'LinearGenomeView') {
    throw new Error(`${line} opened a ${p.type}`)
  }
  return p
}

test('bare files: the genome file is the assembly, the rest are tracks', () => {
  const p = plan('ref.fa reads.bam height:200 calls.vcf.gz --loc chr1:1-100')
  expect(p.config).toBeUndefined()
  expect(p.assembly).toMatchObject({
    name: 'ref.fa',
    sequence: {
      adapter: {
        type: 'IndexedFastaAdapter',
        fastaLocation: { localPath: '/work/ref.fa' },
      },
    },
  })
  expect(p.assemblyName).toBe('ref.fa')
  expect(p.loc).toBe('chr1:1-100')
  expect(p.tracks.map(t => [t.trackId, t.assemblyNames])).toEqual([
    ['reads.bam', ['ref.fa']],
    ['calls.vcf.gz', ['ref.fa']],
  ])
  expect(p.tracks[0]?.adapter).toMatchObject({
    bamLocation: { localPath: '/work/reads.bam' },
  })
  expect(p.show).toEqual([
    { trackId: 'reads.bam', modifiers: ['height:200'] },
    { trackId: 'calls.vcf.gz', modifiers: [] },
  ])
  expect(p.unapplied).toEqual([])
})

test('a track carries its modifiers for the app to apply', () => {
  const p = plan(
    '--genome hg38 r.bam force:true showLegend=true color:strand color.field=strand --track genes height:80',
  )
  expect(p.show).toEqual([
    {
      trackId: 'r.bam',
      modifiers: [
        'force:true',
        'showLegend=true',
        'color:strand',
        'color.field=strand',
      ],
    },
    { trackId: 'genes', modifiers: ['height:80'] },
  ])
  expect(p.unapplied).toEqual([])
})

test('paths resolve against the launch directory, URLs stay as they are', () => {
  const p = plan(
    'g/ref.fa aliases:al.txt a.bam index:i/a.bam.bai https://x.org/b.bw',
    '/data',
  )
  expect(p.assembly?.refNameAliases).toMatchObject({
    adapter: { location: { localPath: '/data/al.txt' } },
  })
  expect(p.tracks.map(t => t.adapter)).toMatchObject([
    {
      bamLocation: { localPath: '/data/a.bam' },
      index: { location: { localPath: '/data/i/a.bam.bai' } },
    },
    { bigWigLocation: { uri: 'https://x.org/b.bw' } },
  ])
})

test('--genome names a hosted config; tracks wait for its assembly name', () => {
  const p = plan('--genome hg38 tumor.bam --track hg38-ncbiRefSeq --loc EGFR')
  expect(p.config).toBe('https://jbrowse.org/ucsc/hg38/config.json')
  expect(p.assembly).toBeUndefined()
  expect(p.assemblyName).toBeUndefined()
  expect(p.tracks[0]).not.toHaveProperty('assemblyNames')
  expect(p.show.map(t => t.trackId)).toEqual(['tumor.bam', 'hg38-ncbiRefSeq'])
})

test('a value a single-value flag cannot use is reported, not dropped', () => {
  expect(plan('--genome hg38 typo.bamm').unapplied).toEqual([
    '--genome typo.bamm',
  ])
  expect(plan('ref.fa height:100 aliases:a.txt').unapplied).toEqual([
    'ref.fa height:100',
  ])
})

test('--loc takes every region after it', () => {
  const p = plan('--genome hg38 --loc chr1:1-100 chr2:5-9')
  expect(p.loc).toBe('chr1:1-100 chr2:5-9')
  expect(p.unapplied).toEqual([])
})

test('--view writes settings on the view', () => {
  expect(
    plan('ref.fa --view axis.grid=false {"trackLabels":"offset"}').view,
  ).toEqual({ axis: { grid: false }, trackLabels: 'offset' })
  expect(plan('ref.fa').view).toEqual({})
  expect(() => plan('ref.fa --view grid')).toThrow(/not a setting/)
})

test('a config URL is fetched over http or https', () => {
  expect(plan('--config https://x.org/c.json').config).toBe(
    'https://x.org/c.json',
  )
  expect(() => plan('--config s3://b/c.json')).toThrow(/http or https/)
})

test('--assembly picks a config genome', () => {
  expect(plan('--config c.json --assembly volvox').assemblyName).toBe('volvox')
  expect(plan('--config c.json').config).toBe('/work/c.json')
})

test('--fasta keeps its aliases: and cytobands: modifiers', () => {
  const p = plan('--fasta ref.fa aliases:al.txt')
  expect(p.assembly).toMatchObject({
    refNameAliases: { adapter: { location: { localPath: '/work/al.txt' } } },
  })
  expect(p.unapplied).toEqual([])
})

test('two files with one basename both open', () => {
  expect(plan('ref.fa t/s.bam n/s.bam').show.map(t => t.trackId)).toEqual([
    's.bam',
    's.bam-2',
  ])
})

test('a plan with no genome, or a second one in a linear view, says so', () => {
  expect(() => plan('reads.bam')).toThrow(/Name a genome/)
  expect(() => plan('ref.fa --genome hg38')).toThrow(
    /ref\.fa is a genome, and --genome names one too/,
  )
  expect(() => plan('--genome hg38 --config c.json')).toThrow(/not both/)
  expect(() => plan('ref.fa --assembly hg38')).toThrow(/--assembly picks/)
  const lgv = (line: string) =>
    launchPlan(parseArgv(line.split(' ')), '/work', 'LinearGenomeView')
  expect(() => lgv('ref.fa other.2bit')).toThrow(/other\.2bit is a genome/)
  expect(() => lgv('ref.fa a_b.paf')).toThrow(
    /a_b\.paf compares two genomes, which a linear view does not show/,
  )
})

test('--chromSizes is a genome', () => {
  expect(plan('--chromSizes a.sizes r.bam')).toMatchObject({
    type: 'LinearGenomeView',
    assemblyName: 'a',
    show: [{ trackId: 'r.bam', modifiers: [] }],
  })
})

describe('comparative plans', () => {
  test('a second genome opens a synteny view, comparisons between the rows', () => {
    const p = anyPlan('a.fa loc:chr1 a_b.paf b.fa --view mark.interpolate=bump')
    expect(p).toMatchObject({
      type: 'LinearSyntenyView',
      views: [{ assembly: 'a.fa', loc: 'chr1' }, { assembly: 'b.fa' }],
      view: { mark: { interpolate: 'bump' } },
      unapplied: [],
    })
    if (p.type === 'LinearGenomeView') {
      throw new Error('a linear plan')
    }
    expect(p.assemblies.map(a => a.sequence.adapter)).toMatchObject([
      { fastaLocation: { localPath: '/work/a.fa' } },
      { fastaLocation: { localPath: '/work/b.fa' } },
    ])
    expect(p.tracks).toMatchObject([
      {
        trackId: 'a_b.paf',
        assemblyNames: ['a.fa', 'b.fa'],
        adapter: { pafLocation: { localPath: '/work/a_b.paf' } },
      },
    ])
  })

  test("jb2export's flags and subcommand words read the same", () => {
    const line =
      '--chromSizes x/a.sizes --chain a_b.chain --chromSizes b.sizes --chain a_b.chain --chromSizes c.sizes'
    const p = launchPlan(parseArgv(line.split(' ')), '/w', 'LinearSyntenyView')
    expect(p).toMatchObject({
      views: [{ assembly: 'a' }, { assembly: 'b' }, { assembly: 'c' }],
      tracks: [
        { trackId: 'a_b.chain', assemblyNames: ['b', 'a'] },
        { trackId: 'a_b.chain-2', assemblyNames: ['c', 'b'] },
      ],
    })
    expect(
      launchPlan(parseArgv(['a.fa', 'b.fa']), '/w', 'DotplotView').type,
    ).toBe('DotplotView')
  })

  test('a dotplot takes two genomes, a synteny view two or more', () => {
    const as = (type: 'DotplotView' | 'LinearSyntenyView', line: string) =>
      launchPlan(parseArgv(line.split(' ')), '/w', type)
    expect(() => as('DotplotView', 'a.fa b.fa c.fa')).toThrow(
      'A dotplot compares two genomes, and this command line names 3',
    )
    expect(() => as('LinearSyntenyView', 'a.fa')).toThrow(
      'A synteny view compares two genomes or more, and this command line names 1',
    )
    expect(() => anyPlan('a.fa a_b.paf')).toThrow(
      /a_b\.paf compares two genomes/,
    )
  })

  test('what a comparative view does not show is reported', () => {
    expect(
      anyPlan('a.fa b.fa reads.bam height:9 --loc chr1 --track genes')
        .unapplied,
    ).toEqual(['/work/reads.bam height:9', '--loc chr1', '--track genes'])
    expect(() => anyPlan('--genome hg38 a.fa b.fa')).toThrow(
      /A synteny view opens on genome files/,
    )
  })
})
