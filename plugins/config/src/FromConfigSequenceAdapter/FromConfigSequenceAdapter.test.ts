import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import Adapter from './FromConfigSequenceAdapter'
import sequenceConfigSchema from './configSchema'

test('adapter can fetch sequences when there is just one feature representing whole refseq', async () => {
  const features = [
    {
      end: 150,
      refName: 'ctgA',
      seq: 'ccaaaccgtcaattaaccggtatcttctcggaaacggcggttctctcctagatagcgatctgtggtctcaccatgcaatttaaacaggtgagtaaagattgctacaaatacgagactagctgtcaccagatgctgttcatctgttggctc',
      start: 0,
      uniqueId: 'one',
    },
  ]
  const adapter = new Adapter(sequenceConfigSchema.create({ features }))
  const result = adapter.getFeatures({
    end: 50,
    refName: 'ctgA',
    start: 0,
  })
  const featuresArray = await firstValueFrom(result.pipe(toArray()))
  expect(featuresArray.length).toBe(1)
  expect(featuresArray[0].get('seq')).toBe(features[0].seq.slice(0, 50))

  const result2 = adapter.getFeatures({
    end: 150,
    refName: 'ctgA',
    start: 100,
  })
  const featuresArray2 = await firstValueFrom(result2.pipe(toArray()))
  expect(featuresArray2.length).toBe(1)
  expect(featuresArray2[0].get('seq')).toBe(features[0].seq.slice(100, 150))
})

test("adapter can fetch sequences when the config's sequence doesn't start at 0", async () => {
  const features = [
    {
      end: 5150,
      refName: 'ctgA',
      seq: 'ccaaaccgtcaattaaccggtatcttctcggaaacggcggttctctcctagatagcgatctgtggtctcaccatgcaatttaaacaggtgagtaaagattgctacaaatacgagactagctgtcaccagatgctgttcatctgttggctc',
      start: 5000,
      uniqueId: 'one',
    },
  ]
  const adapter = new Adapter(sequenceConfigSchema.create({ features }))
  const result = adapter.getFeatures({
    end: 5050,
    refName: 'ctgA',
    start: 4950,
  })
  const featuresArray = await firstValueFrom(result.pipe(toArray()))
  expect(featuresArray.length).toBe(1)
  expect(featuresArray[0].get('seq')).toBe(features[0].seq.slice(0, 50))

  const result2 = adapter.getFeatures({
    end: 5150,
    refName: 'ctgA',
    start: 5050,
  })
  const featuresArray2 = await firstValueFrom(result2.pipe(toArray()))
  expect(featuresArray2.length).toBe(1)
  expect(featuresArray2[0].get('seq')).toBe(features[0].seq.slice(50, 150))
})
