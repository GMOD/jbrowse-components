import { getModTypes } from './getModTypes.ts'

test('getModTypes', () => {
  expect(getModTypes('C+m,')).toMatchSnapshot()
  expect(getModTypes('C+mh,')).toMatchSnapshot()
  expect(getModTypes('C+16061,')).toMatchSnapshot()
  // uppercase single-letter modification code (uncharacterized per SAM spec)
  expect(getModTypes('C+C?,')).toMatchSnapshot()
})
