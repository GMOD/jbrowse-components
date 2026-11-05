import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { refNameColor } from '@jbrowse/core/ui/colors'
import { cssColorToHex } from '@jbrowse/core/util/colorBits'

import { createTablesEngine } from './index.ts'

const engine = createTablesEngine()

const uri = (file: string) => ({
  uri: pathToFileURL(path.resolve(file)).href,
  locationType: 'UriLocation',
})
const dir = mkdtempSync(path.join(tmpdir(), 'tables-contig-colors-'))

const paletteAt = (position: number) =>
  cssColorToHex(refNameColor('', position))

const contigsOf = (file: string) =>
  readFileSync(path.resolve(file), 'utf8')
    .trim()
    .split('\n')
    .map(line => {
      const [refName = '', length = '0'] = line.split('\t')
      return { refName, start: 0, end: Number(length) }
    })

const natural = (a: { refName: string }, b: { refName: string }) =>
  a.refName.localeCompare(b.refName, undefined, { numeric: true })

const GRAPE_SIZES = 'test_data/grape_peach_synteny/grape.chrom.sizes'
const grape = contigsOf(GRAPE_SIZES)
const peach = contigsOf('test_data/Ppersica_298_v2.0.fa.gz.fai').filter(r =>
  r.refName.startsWith('Pp'),
)
const PEACH_GRAPE = {
  type: 'PAFAdapter',
  pafLocation: uri('test_data/peach_grape_small.paf.gz'),
  assemblyNames: ['peach', 'grape'],
}
const byTarget = { encoding: { color: { field: 'target' } } }

test('a contig keeps its assembly-order color alone and whole-genome, where the sequence lists contigs out of natural order', async () => {
  const assembly = { name: 'grape', uri: uri(GRAPE_SIZES).uri }
  const chr2 = grape.findIndex(r => r.refName === 'chr2')
  expect(chr2).toBe(19)
  const view = paletteAt(chr2)
  const chr2Colors = (t: {
    alignments: { targetChrom: string[]; color: string[] }
  }) =>
    new Set(
      t.alignments.color.filter(
        (_, i) => t.alignments.targetChrom[i] === 'chr2',
      ),
    )

  const alone = await engine.synteny({
    adapterConfig: PEACH_GRAPE,
    query: { regions: peach, width: 800 },
    target: {
      regions: grape.filter(r => r.refName === 'chr2'),
      width: 800,
      assembly,
    },
    view: byTarget,
  })
  const wholeGenome = await engine.synteny({
    adapterConfig: PEACH_GRAPE,
    query: { regions: peach, width: 800 },
    target: { regions: grape.toSorted(natural), width: 800, assembly },
    view: byTarget,
  })
  expect(chr2Colors(alone)).toEqual(new Set([view]))
  expect(chr2Colors(wholeGenome)).toEqual(new Set([view]))

  const dotplot = await engine.dotplot({
    adapterConfig: PEACH_GRAPE,
    x: { regions: peach, width: 600 },
    y: { regions: grape.toSorted(natural), width: 600, assembly },
    view: byTarget,
  })
  const dotplotChr2 = dotplot.alignments.color.filter(
    (_, i) => dotplot.alignments.yChrom[i] === 'chr2',
  )
  expect(dotplotChr2.length).toBeGreaterThan(0)
  expect(new Set(dotplotChr2)).toEqual(new Set([view]))
})

test('a PAF spelling contigs by alias paints them at their assembly positions, not hash colors', async () => {
  const aliasFile = path.join(dir, 'volvox.chromAlias.txt')
  writeFileSync(aliasFile, '# ucsc\tother\nctgA\tA\nctgB\tB\n')
  const paf = path.join(dir, 'aliased.paf')
  writeFileSync(
    paf,
    [
      'q1\t1000\t0\t500\t+\tB\t6079\t100\t600\t500\t500\t60',
      'q1\t1000\t500\t1000\t+\tA\t50001\t1000\t1500\t500\t500\t60',
    ].join('\n'),
  )
  const t = await engine.synteny({
    adapterConfig: {
      type: 'PAFAdapter',
      pafLocation: uri(paf),
      assemblyNames: ['q', 'volvox'],
    },
    query: { regions: [{ refName: 'q1', start: 0, end: 1000 }], width: 800 },
    target: {
      regions: [{ refName: 'A', start: 0, end: 50001 }],
      refNames: ['ctgA', 'ctgB'],
      width: 800,
      assembly: {
        name: 'volvox',
        uri: uri('test_data/volvox/volvox.fa').uri,
        refNameAliases: { uri: pathToFileURL(aliasFile).href },
      },
    },
    view: byTarget,
  })
  expect(paletteAt(0)).not.toBe(cssColorToHex(refNameColor('A', undefined)))
  expect(paletteAt(1)).not.toBe(cssColorToHex(refNameColor('B', undefined)))
  expect(t.alignments.targetChrom).toEqual(['A'])
  expect(t.alignments.color).toEqual([paletteAt(0)])
  expect(t.offscreen.color).toEqual([paletteAt(1)])
})

test("a BAM deals mateRefName by its assembly's order, not its header's", async () => {
  const records = readFileSync(
    path.resolve('test_data/volvox/volvox.fa'),
    'utf8',
  )
    .split('>')
    .filter(Boolean)
    .map(record => {
      const [name = '', ...lines] = record.trim().split('\n')
      return { name, seq: lines.join('') }
    })
    .toReversed()
  expect(records.map(r => r.name)).toEqual(['ctgB', 'ctgA'])
  let offset = 0
  const fai = records.map(({ name, seq }) => {
    offset += name.length + 2
    const line = `${name}\t${seq.length}\t${offset}\t${seq.length}\t${seq.length + 1}`
    offset += seq.length + 1
    return line
  })
  const fasta = path.join(dir, 'volvox_ctgB_first.fa')
  writeFileSync(fasta, records.map(r => `>${r.name}\n${r.seq}\n`).join(''))
  writeFileSync(`${fasta}.fai`, `${fai.join('\n')}\n`)

  const t = await engine.alignments({
    adapterConfig: {
      type: 'BamAdapter',
      bamLocation: uri('test_data/volvox/volvox-translocation.bam'),
      index: {
        location: uri('test_data/volvox/volvox-translocation.bam.bai'),
        indexType: 'BAI',
      },
    },
    region: { refName: 'ctgA', start: 19700, end: 20200 },
    assembly: { name: 'volvox_ctgB_first', uri: pathToFileURL(fasta).href },
    display: { encoding: { color: 'mateRefName' } },
  })
  const toCtgB = t.reads.color.filter((_, i) => t.reads.level[i] === 'ctgB')
  expect(toCtgB.length).toBeGreaterThan(0)
  expect(new Set(toCtgB)).toEqual(new Set([paletteAt(0)]))
})
