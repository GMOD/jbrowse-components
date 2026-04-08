import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './PAFAdapter.ts'
import MyConfigSchema from './configSchema.ts'

function makeAdapter() {
  return new Adapter(
    MyConfigSchema.create({
      pafLocation: {
        localPath: require.resolve('./test_data/peach_grape.paf'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['peach', 'grape'],
    }),
  )
}

test('adapter can fetch features from peach_grape.paf', async () => {
  const adapter = makeAdapter()

  const features1 = adapter.getFeatures({
    refName: 'Pp01',
    start: 0,
    end: 200000,
    assemblyName: 'peach',
  })

  const features2 = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 200000,
    assemblyName: 'grape',
  })

  const fa1 = await firstValueFrom(features1.pipe(toArray()))
  const fa2 = await firstValueFrom(features2.pipe(toArray()))
  expect(fa1.length).toBe(11)
  expect(fa2.length).toBe(5)
  expect(fa1[0]!.get('refName')).toBe('Pp01')
  expect(fa2[0]!.get('refName')).toBe('chr1')
})

test('getRefNames returns query ref names for query assembly', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({
    regions: [{ assemblyName: 'peach', refName: '', start: 0, end: 0 }],
  })
  expect(refNames).toContain('Pp01')
})

test('getRefNames returns target ref names for target assembly', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({
    regions: [{ assemblyName: 'grape', refName: '', start: 0, end: 0 }],
  })
  expect(refNames).toContain('chr1')
})

test('getRefNames returns empty for unknown assembly', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({
    regions: [{ assemblyName: 'unknown', refName: '', start: 0, end: 0 }],
  })
  expect(refNames).toEqual([])
})

test('getRefNames returns empty when no regions provided', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({})
  expect(refNames).toEqual([])
})
