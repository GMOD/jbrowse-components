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
})
