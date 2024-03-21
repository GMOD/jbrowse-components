import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import Adapter from './PAFAdapter'
import MyConfigSchema from './configSchema'

test('adapter can fetch features from peach_grape.paf', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      assemblyNames: ['peach', 'grape'],
      pafLocation: {
        localPath: require.resolve('./test_data/peach_grape.paf'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const features1 = adapter.getFeatures({
    assemblyName: 'peach',
    end: 200000,
    refName: 'Pp01',
    start: 0,
  })

  const features2 = adapter.getFeatures({
    assemblyName: 'grape',
    end: 200000,
    refName: 'chr1',
    start: 0,
  })

  const fa1 = await firstValueFrom(features1.pipe(toArray()))
  const fa2 = await firstValueFrom(features2.pipe(toArray()))
  expect(fa1.length).toBe(11)
  expect(fa2.length).toBe(5)
  expect(fa1[0].get('refName')).toBe('Pp01')
  expect(fa2[0].get('refName')).toBe('chr1')
})
