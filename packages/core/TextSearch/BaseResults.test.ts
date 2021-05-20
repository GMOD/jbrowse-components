import BaseResult, {
  LocStringResult,
  RefSequenceResult,
  BaseResultArgs,
} from './BaseResults'

test('create BaseResult', () => {
  const baseResult = new BaseResult({
    label: 'chr1',
  })

  expect(baseResult.getLabel()).toEqual('chr1')
  expect(baseResult.getLocation()).toEqual('chr1')
})

test('create LocationResult', () => {
  const locationResult = new LocStringResult({
    label: 'location result',
    locString: 'chr1:1-900',
  })
  expect(locationResult.getLabel()).toEqual('location result')
  expect(locationResult.getLocation()).toEqual('chr1:1-900')
})

test('create RefSequenceResult', () => {
  const refSeqResult = new RefSequenceResult({
    refName: 'chr1',
    label: 'chromosome 1',
  })

  expect(refSeqResult.getLabel()).toEqual('chromosome 1')
  expect(refSeqResult.getLocation()).toEqual('chr1')
})

test('can update score of result and throw appropriate errors', () => {
  const refSeqResult = new RefSequenceResult({
    refName: 'chr1',
    label: 'chromosome 1',
  })

  expect(refSeqResult.getScore()).toBe(1)
  refSeqResult.updateScore(1000)
  expect(refSeqResult.getScore()).toBe(1000)
  expect(() => {
    new RefSequenceResult({
      label: 'chromosome 1',
    })
  }).toThrow('must provide refName')
  expect(() => {
    new LocStringResult({
      label: 'chromosome 1',
    })
  }).toThrow('must provide locString')
})
