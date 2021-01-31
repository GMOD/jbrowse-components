import { toArray } from 'rxjs/operators'
import Adapter from './FromConfigSequenceAdapter'
import { sequenceConfigSchema } from './configSchema'

test('adapter can fetch sequences', async () => {
  const features = [
    {
      uniqueId: 'one',
      refName: 'ctgA',
      start: 250,
      end: 400,
      seq:
        'ccaaaccgtcaattaaccggtatcttctcggaaacggcggttctctcctagatagcgatctgtggtctcaccatgcaatttaaacaggtgagtaaagattgctacaaatacgagactagctgtcaccagatgctgttcatctgttggctc',
    },
    {
      uniqueId: 'two',
      refName: 'ctgA',
      start: 150,
      end: 250,
      seq:
        'attctgattcagcctgacttctcttggaaccctgcccataaatcaaagggttagtgcggccaaaacgttggacaacggtattagaagaccaacctgacca',
    },
    {
      uniqueId: 'three',
      refName: 'ctgB',
      start: 50,
      end: 60,
      seq: 'TACATGCTAGC',
    },
  ]
  const adapter = new Adapter(sequenceConfigSchema.create({ features }))
  const result = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 500,
  })
  const featuresArray = await result.pipe(toArray()).toPromise()
  expect(featuresArray.length).toBe(2)
  expect(featuresArray[0].toJSON()).toEqual(features[1])
})

test('adapter can fetch regions 1', async () => {
  const features = [
    { uniqueId: 'one', refName: 'ctgA', start: 250, end: 400 },
    { uniqueId: 'two', refName: 'ctgA', start: 150, end: 300 },
    { uniqueId: 'three', refName: 'ctgB', start: 50, end: 60 },
  ]
  const adapter = new Adapter(sequenceConfigSchema.create({ features }))
  const result = await adapter.getRegions()
  expect(result).toEqual([
    { refName: 'ctgA', start: 150, end: 400 },
    { refName: 'ctgB', start: 50, end: 60 },
  ])
})
