import SimpleFeature from './simpleFeature'

test('can create a simple feature', () => {
  const f = new SimpleFeature({
    uniqueId: 'test',
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
    start: 100,
    end: 500,
    subfeatures: [
      { start: 100, end: 200, uniqueId: 'test-one' },
      { start: 400, end: 500, uniqueId: 'test-two' },
    ],
  })
  expect(f.id()).toEqual('test')
  expect(f.get('start')).toEqual(100)
  expect(f.get('end')).toEqual(500)
  expect(f.get('subfeatures')[0].get('start')).toEqual(100)
})
