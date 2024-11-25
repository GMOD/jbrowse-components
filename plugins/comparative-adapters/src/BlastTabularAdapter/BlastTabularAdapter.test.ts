import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import Adapter from './BlastTabularAdapter'
import MyConfigSchema from './configSchema'

test('adapter can fetch features from peach_grape.paf', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      blastTableLocation: {
        localPath: require.resolve('./test_data/peach_vs_grape.tsv.gz'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['peach', 'grape'],
    }),
  )

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
