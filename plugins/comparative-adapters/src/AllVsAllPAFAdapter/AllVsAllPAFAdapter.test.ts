import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './AllVsAllPAFAdapter.ts'
import configSchema from './configSchema.ts'

// Write an inline PAF to a temp file and return a LocalPathLocation for it.
const writePaf = (rows: string[]) => {
  const path = join(mkdtempSync(join(tmpdir(), 'ava-paf-')), 'in.paf')
  writeFileSync(path, `${rows.join('\n')  }\n`)
  return { localPath: path, locationType: 'LocalPathLocation' as const }
}

const paf = () => ({
  localPath: require.resolve('./test_data/all_vs_all.paf'),
  locationType: 'LocalPathLocation' as const,
})

function makeAdapter(
  assemblyNames: string[],
  assemblyNameToPanSN: Record<string, string> = {},
  pafLocation = paf(),
) {
  return new Adapter(
    configSchema.create({
      pafLocation,
      assemblyNames,
      assemblyNameToPanSN,
    }),
  )
}

// the real fixture the browser suite drives (volvox_ins/volvox/volvox_del
// pangenome), for a realistic end-to-end check with CIGAR + de:f: tags
const volvoxPaf = () => ({
  localPath:
    require.resolve('../../../../test_data/volvox/volvox_all_vs_all.paf'),
  locationType: 'LocalPathLocation' as const,
})

const feats = (
  adapter: Adapter,
  region: Record<string, unknown>,
  opts: Record<string, unknown> = {},
) =>
  firstValueFrom(
    adapter.getFeatures(region as never, opts as never).pipe(toArray()),
  )

// one-vs-all in a plain LGV (no targetAssemblyName): the queried assembly draws
// against every OTHER sample in the file, AND its own paralogy (same-sample,
// different locus). `assemblyNames` need not list a mate for it to draw.
const byMateRef = (fa: Awaited<ReturnType<typeof feats>>) =>
  Object.fromEntries(
    fa.map(f => [
      (f.get('mate') as { refName: string }).refName,
      f.get('mate') as { refName: string; assemblyName: string },
    ]),
  )

test('cross-sample block sharing a contig name + coords is not dropped as a self-diagonal', async () => {
  // col = qname qlen qstart qend strand tname tlen tstart tend nmatch blocklen mapq
  const loc = writePaf([
    // grape vs peach, both `chr1`, IDENTICAL coords: a real cross-sample block
    // (conserved region) that must draw — not a self-diagonal
    'grape#1#chr1\t1000\t100\t200\t+\tpeach#1#chr1\t1000\t100\t200\t95\t100\t60',
    // grape vs ITSELF, same contig + identical coords: a true self-diagonal, dropped
    'grape#1#chr1\t1000\t300\t400\t+\tgrape#1#chr1\t1000\t300\t400\t100\t100\t60',
  ])
  const fa = await feats(makeAdapter(['grape', 'peach'], {}, loc), {
    refName: 'chr1',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  // only the cross-sample block survives; the same-sample self-diagonal is gone
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('mate')).toMatchObject({
    refName: 'chr1',
    assemblyName: 'peach',
  })
})

test('one-vs-all: grape draws against peach, cacao, and its own paralog', async () => {
  const fa = await feats(makeAdapter(['grape', 'peach']), {
    refName: 'chr1',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(3)
  expect(fa.every(f => f.get('refName') === 'chr1')).toBe(true)
  const mates = byMateRef(fa)
  // peach is listed so it gets its assembly label
  expect(mates.G1).toMatchObject({ assemblyName: 'peach' })
  // cacao is NOT in assemblyNames, so the mate is labelled by its PanSN prefix
  expect(mates.I).toMatchObject({ assemblyName: 'cacao' })
  // paralogy: grape#1#chr1 vs grape#1#chr2, mate labelled as grape's own assembly
  expect(mates.chr2).toMatchObject({ assemblyName: 'grape' })
})

test('paralogy is per-locus: the chr2 copy draws when viewing chr2, mated to chr1', async () => {
  const fa = await feats(makeAdapter(['grape', 'peach']), {
    refName: 'chr2',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('refName')).toBe('chr2')
  expect(fa[0]!.get('mate')).toMatchObject({
    refName: 'chr1',
    assemblyName: 'grape',
  })
})

test('same-contig tandem paralogy double-emits both loci with distinct ids', async () => {
  const fa = await feats(makeAdapter(['grape']), {
    refName: 'chr3',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  // grape#1#chr3:100-200 vs grape#1#chr3:300-400 draws at BOTH loci
  expect(fa.length).toBe(2)
  const ids = fa.map(f => f.id())
  expect(new Set(ids).size).toBe(2)
  const byStart = Object.fromEntries(
    fa.map(f => [f.get('start'), f.get('mate') as { start: number }]),
  )
  expect(byStart[100]).toMatchObject({ start: 300 })
  expect(byStart[300]).toMatchObject({ start: 100 })
})

test('one-vs-all: peach draws against cacao (listed) and grape (unlisted)', async () => {
  const fa = await feats(makeAdapter(['peach', 'cacao']), {
    refName: 'G1',
    start: 0,
    end: 2000,
    assemblyName: 'peach',
  })
  expect(fa.length).toBe(2)
  const mates = byMateRef(fa)
  expect(mates.I).toMatchObject({ assemblyName: 'cacao' })
  expect(mates.chr1).toMatchObject({ assemblyName: 'grape' })
})

test('assemblyNameToPanSN maps JBrowse names to PanSN sample prefixes', async () => {
  const fa = await feats(
    makeAdapter(['grapeJB', 'peachJB'], { grapeJB: 'grape', peachJB: 'peach' }),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grapeJB' },
  )
  const mates = byMateRef(fa)
  // grape (grapeJB) draws against peach (mapped to peachJB) and cacao (unlisted)
  expect(mates.G1).toMatchObject({ assemblyName: 'peachJB' })
  expect(mates.I).toMatchObject({ assemblyName: 'cacao' })
})

test('one full-list track, targetAssemblyName isolates the band (grape query, peach target keeps only grape-peach, not grape-cacao)', async () => {
  const fa = await feats(
    makeAdapter(['grape', 'peach', 'cacao']),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grape' },
    { targetAssemblyName: 'peach' },
  )
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('mate')).toMatchObject({
    refName: 'G1',
    assemblyName: 'peach',
  })
})

test('one full-list track, switching targetAssemblyName redraws a different band (grape query, cacao target)', async () => {
  const fa = await feats(
    makeAdapter(['grape', 'peach', 'cacao']),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grape' },
    { targetAssemblyName: 'cacao' },
  )
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('mate')).toMatchObject({
    refName: 'I',
    assemblyName: 'cacao',
  })
})

test('getRefNames on a full-list track scopes to the target pair', async () => {
  const names = await makeAdapter(['grape', 'peach', 'cacao']).getRefNames({
    assemblyName: 'grape',
    targetAssemblyName: 'peach',
  })
  expect([...names].sort()).toEqual(['chr1'])
})

test('getRefNames one-vs-all includes paralogy contigs (chr2/chr3 have only grape-grape alignments)', async () => {
  const names = await makeAdapter(['grape', 'peach']).getRefNames({
    assemblyName: 'grape',
  })
  expect([...names].sort()).toEqual(['chr1', 'chr2', 'chr3'])
})

// realistic fixture: volvox is aligned to both volvox_ins and volvox_del; a
// plain LGV (no targetAssemblyName) on volvox is exactly the one-vs-all case.
test('real all-vs-all fixture: volvox LGV draws against both other samples', async () => {
  const fa = await feats(
    makeAdapter(['volvox_ins', 'volvox', 'volvox_del'], {}, volvoxPaf()),
    { refName: 'ctgA', start: 0, end: 60000, assemblyName: 'volvox' },
  )
  expect(fa.length).toBe(2)
  expect(fa.every(f => f.get('refName') === 'ctgA')).toBe(true)
  const mateAsms = fa
    .map(f => (f.get('mate') as { assemblyName: string }).assemblyName)
    .sort()
  expect(mateAsms).toEqual(['volvox_del', 'volvox_ins'])
  // CIGAR survives the real parse (orientAlignment ran without throwing)
  expect(fa.every(f => typeof f.get('CIGAR') === 'string')).toBe(true)
})

// the payoff: a mate that is NOT in assemblyNames still draws (labelled by its
// PanSN prefix), so you need only load the assembly you're viewing
test('real all-vs-all fixture: draws against an assembly missing from assemblyNames', async () => {
  const fa = await feats(
    makeAdapter(['volvox', 'volvox_ins'], {}, volvoxPaf()),
    { refName: 'ctgA', start: 0, end: 60000, assemblyName: 'volvox' },
  )
  expect(fa.length).toBe(2)
  const mateAsms = fa
    .map(f => (f.get('mate') as { assemblyName: string }).assemblyName)
    .sort()
  // volvox_del is absent from assemblyNames yet is still drawn, prefix-labelled
  expect(mateAsms).toEqual(['volvox_del', 'volvox_ins'])
})
