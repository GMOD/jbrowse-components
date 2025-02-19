import { fireEvent, render } from '@testing-library/react'

import WiggleRendering from './WiggleRendering'

// these tests do very little, let's try to expand them at some point
test('one', async () => {
  const { container, getByTestId } = render(
    <WiggleRendering
      width={500}
      height={500}
      features={new Map()}
      regions={[{ refName: 'chr1', start: 1, end: 3, assemblyName: 'volvox' }]}
      bpPerPx={3}
      blockKey="test"
      onMouseMove={() => {}}
      onMouseLeave={() => {}}
      onFeatureClick={() => {}}
    />,
  )
  const test = getByTestId('wiggle-rendering-test')
  expect(fireEvent.click(test)).toBeTruthy()
  expect(container).toMatchSnapshot()
})
