import { render } from '@testing-library/react'

import FeatureDetailsFrame from './FeatureDetailsFrame.tsx'

test('a formatDetails error replaces the panel', () => {
  const { getByText, queryByText } = render(
    <FeatureDetailsFrame model={{ error: new Error('bad callback') }}>
      body
    </FeatureDetailsFrame>,
  )
  expect(getByText(/bad callback/)).toBeTruthy()
  expect(queryByText('body')).toBeNull()
})

test('no feature says so rather than drawing an empty panel', () => {
  const { getByText, queryByText } = render(
    <FeatureDetailsFrame model={{}}>body</FeatureDetailsFrame>,
  )
  expect(getByText(/No feature loaded/)).toBeTruthy()
  expect(queryByText('body')).toBeNull()
})

test('a feature draws the body', () => {
  const { getByText } = render(
    <FeatureDetailsFrame
      model={{
        featureData: { uniqueId: 'f', refName: 'ctgA', start: 0, end: 1 },
      }}
    >
      body
    </FeatureDetailsFrame>,
  )
  expect(getByText('body')).toBeTruthy()
})
