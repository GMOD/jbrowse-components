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
  writeFileSync(path, `${rows.join('\n')}\n`)
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

test('hap1 vs hap2 of one sample at identical coords is not dropped as a self-diagonal', async () => {
  const loc = writePaf([
    // a diploid sample's two haplotypes aligned in a conserved region: same
    // sample, same stripped contig, identical coords — everything the old
    // sample+contig self-diagonal test keyed on — but a real alignment
    'grape#1#chr1\t1000\t100\t200\t+\tgrape#2#chr1\t1000\t100\t200\t99\t100\t60',
    // the true self-diagonal: one sequence against ITSELF, still dropped
    'grape#1#chr1\t1000\t400\t500\t+\tgrape#1#chr1\t1000\t400\t500\t100\t100\t60',
  ])
  const fa = await feats(makeAdapter(['grape'], {}, loc), {
    refName: 'chr1',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  // both haplotypes collapse into the one `grape` assembly at chr1, so the
  // hap1-vs-hap2 block draws at each of its two loci
  expect(fa.length).toBe(2)
  expect(fa.map(f => f.get('start')).sort()).toEqual([100, 100])
})

// A haplotype-resolved pangenome loads each haplotype as its own JBrowse
// assembly, so assemblyNameToPanSN names a `sample#haplotype` prefix rather than
// a sample. The same file still serves the sample-level configuration above.
const diploidPaf = () =>
  writePaf([
    'grape#1#chr1\t1000\t100\t200\t+\tgrape#2#chr1\t1000\t100\t200\t99\t100\t60',
    'grape#1#chr1\t1000\t700\t800\t+\tpeach#1#G1\t1000\t100\t200\t95\t100\t60',
  ])

const HAP_TO_PANSN = { grapeHap1: 'grape#1', grapeHap2: 'grape#2' }

test('haplotype-level assemblies resolve to one haplotype each', async () => {
  const fa = await feats(
    makeAdapter(
      ['grapeHap1', 'grapeHap2', 'peach'],
      HAP_TO_PANSN,
      diploidPaf(),
    ),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grapeHap1' },
  )
  // only the hap1 side anchors, so the inter-haplotype block draws once rather
  // than at both loci the way it does when both haplotypes are one assembly
  expect(fa.map(f => f.get('start')).sort((a, b) => a - b)).toEqual([100, 700])
  const mates = byMateRef(fa)
  expect(mates.chr1).toMatchObject({ assemblyName: 'grapeHap2' })
  expect(mates.G1).toMatchObject({ assemblyName: 'peach' })
})

test('haplotype-level: targetAssemblyName isolates the hap1-vs-hap2 band', async () => {
  const fa = await feats(
    makeAdapter(
      ['grapeHap1', 'grapeHap2', 'peach'],
      HAP_TO_PANSN,
      diploidPaf(),
    ),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grapeHap1' },
    { targetAssemblyName: 'grapeHap2' },
  )
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('start')).toBe(100)
})

// a sample-level prefix must not match a longer sample name that merely starts
// with it, which a bare startsWith would let through
test('a sample prefix does not match a longer sample name', async () => {
  const loc = writePaf([
    'grape#1#chr1\t1000\t100\t200\t+\tgrapefruit#1#chr1\t1000\t100\t200\t95\t100\t60',
  ])
  const fa = await feats(makeAdapter(['grape', 'grapefruit'], {}, loc), {
    refName: 'chr1',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('mate')).toMatchObject({ assemblyName: 'grapefruit' })
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

// getRefNames and getFeatures run one `sideDraws` gate, so a reported contig
// always has at least one feature. A contig whose only row is a degenerate
// self-diagonal (minimap2 without -X emits one per sequence) is the case that
// used to slip through: getFeatures dropped it, getRefNames did not.
test('getRefNames drops a contig whose only alignment is a self-diagonal', async () => {
  const pafLocation = writePaf([
    'grape#1#chr1\t1000\t100\t200\t+\tpeach#1#G1\t1000\t300\t400\t90\t100\t60',
    'grape#1#chrSelf\t1000\t0\t500\t+\tgrape#1#chrSelf\t1000\t0\t500\t500\t500\t60',
  ])
  const adapter = makeAdapter(['grape', 'peach'], {}, pafLocation)
  const names = await adapter.getRefNames({ assemblyName: 'grape' })
  expect([...names].sort()).toEqual(['chr1'])
  expect(
    await feats(adapter, {
      refName: 'chrSelf',
      start: 0,
      end: 1000,
      assemblyName: 'grape',
    }),
  ).toEqual([])
})

test('every contig getRefNames reports yields at least one feature', async () => {
  const adapter = makeAdapter(['grape', 'peach'])
  const names = await adapter.getRefNames({ assemblyName: 'grape' })
  for (const refName of names) {
    expect(
      (
        await feats(adapter, {
          refName,
          start: 0,
          end: 1000,
          assemblyName: 'grape',
        })
      ).length,
    ).toBeGreaterThan(0)
  }
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

// An assembly whose name is not the PanSN sample prefix used to produce a
// configured track that drew nothing, reported nothing, and looked exactly like
// a locus with no alignments — hasDataForRefName is unconditionally true, so
// nothing filtered it out. The prefixes are also the one thing no form or config
// editor shows, so the error carries them.
describe('an assembly the file has never heard of', () => {
  test('names what the file does hold, and how to map onto it', async () => {
    await expect(
      feats(makeAdapter(['Vitis_vinifera', 'peach']), {
        refName: 'chr1',
        start: 0,
        end: 2000,
        assemblyName: 'Vitis_vinifera',
      }),
    ).rejects.toThrow(
      /No sequences in this file belong to assembly "Vitis_vinifera".*samples are: cacao, grape, peach.*assemblyNameToPanSN.*\{"Vitis_vinifera": "cacao"\}/s,
    )
  })

  test('a wrong mapping names the prefix it resolved to, not just the assembly', async () => {
    await expect(
      feats(makeAdapter(['grapeJB', 'peach'], { grapeJB: 'Vitis' }), {
        refName: 'chr1',
        start: 0,
        end: 2000,
        assemblyName: 'grapeJB',
      }),
    ).rejects.toThrow(/assembly "grapeJB" \(PanSN prefix "Vitis"\)/)
  })

  // a different mistake with a different remedy — usually a pairwise PAF opened
  // with an all-vs-all adapter — so listing its contigs as samples reads as
  // nonsense
  test('a file with no PanSN prefix at all says so instead', async () => {
    const loc = writePaf([
      'chr1\t1000\t100\t200\t+\tchr2\t1000\t100\t200\t95\t100\t60',
    ])
    await expect(
      feats(makeAdapter(['grape', 'peach'], {}, loc), {
        refName: 'chr1',
        start: 0,
        end: 2000,
        assemblyName: 'grape',
      }),
    ).rejects.toThrow(/carry no PanSN sample prefix/)
  })

  // the ordinary case this must not fire on: the prefix is present, the contig
  // simply has no alignments
  test('a known assembly on a contig with no alignments is still empty, not an error', async () => {
    expect(
      await feats(makeAdapter(['grape', 'peach']), {
        refName: 'no_such_contig',
        start: 0,
        end: 2000,
        assemblyName: 'grape',
      }),
    ).toEqual([])
  })
})
