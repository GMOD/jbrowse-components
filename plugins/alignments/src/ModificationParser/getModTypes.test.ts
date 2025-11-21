import { expect, test } from 'vitest'

import { getModTypes } from './getModTypes'

test('getModTypes', () => {
  expect(getModTypes('C+m,')).toMatchSnapshot()
  expect(getModTypes('C+mh,')).toMatchSnapshot()
  expect(getModTypes('C+16061,')).toMatchSnapshot()
})
