import { getModTypes } from './getModTypes.ts'

test('getModTypes', () => {
  expect(getModTypes('C+m,')).toMatchSnapshot()
  expect(getModTypes('C+mh,')).toMatchSnapshot()
  expect(getModTypes('C+16061,')).toMatchSnapshot()
})
