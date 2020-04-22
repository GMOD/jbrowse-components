import { toArray } from 'rxjs/operators'
import Adapter from './PAFAdapter'

test('adapter can fetch features from peach_grape.paf', async () => {
  const adapter = new Adapter({
    pafLocation: {
      localPath: require.resolve('./test_data/peach_grape.paf'),
    },
    assemblyNames: ['peach', 'grape'],
  })

  const features1 = await adapter.getFeatures({
    refName: 'Pp01',
    start: 0,
    end: 200000,
    assemblyName: 'peach',
  })

  const features2 = await adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 200000,
    assemblyName: 'grape',
  })

  const fa1 = await features1.pipe(toArray()).toPromise()
  const fa2 = await features2.pipe(toArray()).toPromise()
  expect(fa1.length).toBe(11)
  expect(fa2.length).toBe(5)
  expect(fa1[0].get('refName')).toBe('Pp01')
  expect(fa2[0].get('refName')).toBe('chr1')
})
