import { toArray } from 'rxjs/operators'
import Adapter from './FromConfigSequenceAdapter'
import { sequenceConfigSchema } from './configSchema'

test('adapter can fetch sequences', async () => {
  const features = [
    {
      uniqueId: 'one',
      refName: 'ctgA',
      start: 0,
      end: 150,
      seq:
        'ccaaaccgtcaattaaccggtatcttctcggaaacggcggttctctcctagatagcgatctgtggtctcaccatgcaatttaaacaggtgagtaaagattgctacaaatacgagactagctgtcaccagatgctgttcatctgttggctc',
    },
  ]
  const adapter = new Adapter(sequenceConfigSchema.create({ features }))
  const result = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 50,
  })
  const featuresArray = await result.pipe(toArray()).toPromise()
  expect(featuresArray.length).toBe(1)
  expect(featuresArray[0].get('seq')).toBe(features[0].seq.slice(0, 50))

  const result2 = adapter.getFeatures({
    refName: 'ctgA',
    start: 100,
    end: 150,
  })
  const featuresArray2 = await result2.pipe(toArray()).toPromise()
  expect(featuresArray2.length).toBe(1)
  expect(featuresArray2[0].get('seq')).toBe(features[0].seq.slice(100, 150))
})
