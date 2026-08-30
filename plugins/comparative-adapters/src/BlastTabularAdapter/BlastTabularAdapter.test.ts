import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './BlastTabularAdapter.ts'
import MyConfigSchema from './configSchema.ts'

function makeAdapter(assemblyNames = ['peach', 'grape']) {
  return new Adapter(
    MyConfigSchema.create({
      blastTableLocation: {
        localPath: require.resolve('./test_data/peach_vs_grape.tsv.gz'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames,
    }),
  )
}

test('adapter can fetch features from peach_grape.paf', async () => {
  const adapter = makeAdapter()

  const features1 = adapter.getFeatures({
    refName: 'Pp05',
    start: 0,
    end: 200000,
    assemblyName: 'peach',
  })

  const features2 = adapter.getFeatures({
    refName: 'chr18',
    start: 0,
    end: 200000,
    assemblyName: 'grape',
  })

  const fa1 = await firstValueFrom(features1.pipe(toArray()))
  const fa2 = await firstValueFrom(features2.pipe(toArray()))
  expect(fa1.length).toBe(204)
  expect(fa2.length).toBe(263)
  expect(fa1[0]!.get('refName')).toBe('Pp05')
  expect(fa2[0]!.get('refName')).toBe('chr18')
})

// The perspective decides which of qseqid/sseqid is the feature and which is
// the mate, and the mate's assembly is the other side of the pair. Asserted
// from both ends because a rule that reads the side one way in getFeatures and
// another in getRefNames still passes a single-perspective test.
test('each perspective labels its mate with the other assembly', async () => {
  const adapter = makeAdapter()

  const fromPeach = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'Pp05',
        start: 0,
        end: 200000,
        assemblyName: 'peach',
      })
      .pipe(toArray()),
  )
  const fromGrape = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'chr18',
        start: 0,
        end: 200000,
        assemblyName: 'grape',
      })
      .pipe(toArray()),
  )

  const peachMate = fromPeach[0]!.get('mate') as { assemblyName: string }
  const grapeMate = fromGrape[0]!.get('mate') as { assemblyName: string }
  expect(peachMate.assemblyName).toBe('grape')
  expect(grapeMate.assemblyName).toBe('peach')
})

// -1 from the shared side rule, which every pairwise adapter turns into an
// empty answer rather than a throw or a download. getRefNames resolves it
// before the setup, so an unlisted assembly never fetches the table at all.
test('an assembly this adapter does not carry gets an empty answer', async () => {
  const warned = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const adapter = makeAdapter()

  expect(await adapter.getRefNames({ assemblyName: 'mouse' })).toEqual([])
  expect(await adapter.getRefNames({})).toEqual([])

  const features = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'Pp05',
        start: 0,
        end: 200000,
        assemblyName: 'mouse',
      })
      .pipe(toArray()),
  )
  expect(features).toEqual([])
  expect(warned).toHaveBeenCalledWith('mouse not found in this adapter')
  warned.mockRestore()
})

// A self-alignment names one assembly on both sides. Picking the side by first
// match answered the qseqid columns for every query, so a contig only the
// sseqid column names returned nothing at all.
test('a self-alignment serves both columns of the table', async () => {
  const adapter = makeAdapter(['self', 'self'])

  const fromQueryColumn = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'Pp05',
        start: 0,
        end: 200000,
        assemblyName: 'self',
      })
      .pipe(toArray()),
  )
  const fromSubjectColumn = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'chr18',
        start: 0,
        end: 200000,
        assemblyName: 'self',
      })
      .pipe(toArray()),
  )
  expect(fromQueryColumn.length).toBe(204)
  expect(fromSubjectColumn.length).toBe(263)
  expect(fromSubjectColumn[0]!.get('refName')).toBe('chr18')
})

test('a self-alignment reports the contigs of both columns as its refNames', async () => {
  const refNames = await makeAdapter(['self', 'self']).getRefNames({
    assemblyName: 'self',
  })
  expect(refNames).toContain('Pp05')
  expect(refNames).toContain('chr18')
  expect(new Set(refNames).size).toBe(refNames.length)
})

// A BLAST run of a genome against itself reports every hit twice, once from
// each end — the tandem duplication below is the point of such a run, and
// blastn writes it as ctgA:100-200/ctgA:500-600 AND ctgA:500-600/ctgA:100-200.
// Serving both columns reaches all four of those, and each locus drew twice.
function makeMirroredAdapter() {
  const path = join(mkdtempSync(join(tmpdir(), 'blast-self-')), 'hits.tsv')
  const row = (
    qseqid: string,
    sseqid: string,
    qstart: number,
    qend: number,
    sstart: number,
    send: number,
  ) =>
    `${qseqid}\t${sseqid}\t99.0\t100\t1\t0\t${qstart}\t${qend}\t${sstart}\t${send}\t1e-50\t200\n`
  writeFileSync(
    path,
    row('ctgA', 'ctgA', 100, 200, 500, 600) +
      row('ctgA', 'ctgA', 500, 600, 100, 200),
  )
  return new Adapter(
    MyConfigSchema.create({
      blastTableLocation: {
        localPath: path,
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['self', 'self'],
    }),
  )
}

test('a self-alignment whose hits are written from both ends draws each locus once', async () => {
  const features = await firstValueFrom(
    makeMirroredAdapter()
      .getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'self',
      })
      .pipe(toArray()),
  )
  // the duplication's two loci, and only those: not four. BLAST's 1-based
  // inclusive starts land one lower as half-open.
  expect(features.map(f => f.get('start')).sort((a, b) => a - b)).toEqual([
    99, 499,
  ])
  expect(features.map(f => f.get('mate'))).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ start: 99 }),
      expect.objectContaining({ start: 499 }),
    ]),
  )
})
