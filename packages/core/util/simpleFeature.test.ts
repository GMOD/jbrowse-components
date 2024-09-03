import SimpleFeature from './simpleFeature'

test('can create a simple feature', () => {
  const f = new SimpleFeature({
    uniqueId: 'test',
    refName: 't1',
    start: 100,
    end: 200,
  })
  expect(f.id()).toEqual('test')
  expect(f.get('start')).toEqual(100)
  expect(f.get('end')).toEqual(200)
})

test('can create a simple with subfeatures', () => {
  const f = new SimpleFeature({
    uniqueId: 'test',
    refName: 't1',
    start: 100,
    end: 500,
    subfeatures: [
      { refName: 't1', start: 100, end: 200 },
      { refName: 't1', start: 400, end: 500 },
    ],
  })
  expect(f.id()).toEqual('test')
  expect(f.get('start')).toEqual(100)
  expect(f.get('end')).toEqual(500)
  expect(f.get('subfeatures')[0].get('start')).toEqual(100)
})
