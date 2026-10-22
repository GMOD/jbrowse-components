import { launchPlan } from './launchPlan.ts'
import { parseArgv } from './parseArgv.ts'

const plan = (line: string, cwd = '/work') =>
  launchPlan(parseArgv(line.split(' ')), cwd)

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
    { trackId: 'reads.bam', height: 200 },
    'calls.vcf.gz',
  ])
  expect(p.unapplied).toEqual([])
})

test('a track carries the settings every track type takes; the rest are reported', () => {
  const p = plan(
    '--genome hg38 r.bam force:true showLegend=true color:strand color.field=strand --track genes height:80',
  )
  expect(p.show).toEqual([
    { trackId: 'r.bam', forceLoad: true, showLegend: true },
    { trackId: 'genes', height: 80 },
  ])
  expect(p.unapplied).toEqual([
    'r.bam color:strand',
    'r.bam color.field=strand',
  ])
  expect(() => plan('ref.fa r.bam height:tall')).toThrow(
    'Invalid height value "tall". Expected a number.',
  )
})

test('paths resolve against the launch directory, URLs stay as they are', () => {
  const p = plan(
    'g/ref.fa aliases:al.txt a.bw index:i/a.bw.idx https://x.org/b.bw',
    '/data',
  )
  expect(p.assembly?.refNameAliases).toMatchObject({
    adapter: { location: { localPath: '/data/al.txt' } },
  })
  expect(p.tracks.map(t => t.adapter)).toMatchObject([
    { bigWigLocation: { localPath: '/data/a.bw' } },
    { bigWigLocation: { uri: 'https://x.org/b.bw' } },
  ])
})

test('--genome names a hosted config; tracks wait for its assembly name', () => {
  const p = plan('--genome hg38 tumor.bam --track hg38-ncbiRefSeq --loc EGFR')
  expect(p.config).toBe('https://jbrowse.org/ucsc/hg38/config.json')
  expect(p.assembly).toBeUndefined()
  expect(p.assemblyName).toBeUndefined()
  expect(p.tracks[0]).not.toHaveProperty('assemblyNames')
  expect(p.show).toEqual(['tumor.bam', 'hg38-ncbiRefSeq'])
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
  expect(plan('ref.fa t/s.bam n/s.bam').show).toEqual(['s.bam', 's.bam-2'])
})

test('a plan with no genome, or two, says so', () => {
  expect(() => plan('reads.bam')).toThrow(/Name a genome/)
  expect(() => plan('ref.fa --genome hg38')).toThrow(
    /ref\.fa is a genome, and --genome names one too/,
  )
  expect(() => plan('--genome hg38 --config c.json')).toThrow(/not both/)
  expect(() => plan('ref.fa --assembly hg38')).toThrow(/--assembly picks/)
  expect(() => plan('ref.fa other.2bit')).toThrow(/other\.2bit is a genome/)
  expect(() => plan('ref.fa --fasta other.fa')).toThrow(/other\.fa is a genome/)
})
