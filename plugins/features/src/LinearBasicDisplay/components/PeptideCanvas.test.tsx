import { render } from '@testing-library/react'

import PeptideCanvas from './PeptideCanvas.tsx'

const region = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  reversed: false,
  screenStartPx: 0,
  screenEndPx: 1000,
}

function canvasFor(contentHeight: number, scrollBucket: number) {
  const { container } = render(
    <PeptideCanvas
      renderDataMap={new Map()}
      visibleRegions={[region]}
      viewInitialized
      width={1000}
      contentHeight={contentHeight}
      viewportHeight={600}
      scrollBucket={scrollBucket}
      bpPerPx={0.1}
    />,
  )
  return container.querySelector('canvas')
}

test('sizes the canvas to the scroll band and places it at the band top', () => {
  const canvas = canvasFor(50000, 3)
  expect(canvas?.style.top).toBe('800px')
  expect(canvas?.style.height).toBe('1800px')
})

test('starts at the top of the content and stops at its end', () => {
  const canvas = canvasFor(1000, 0)
  expect(canvas?.style.top).toBe('0px')
  expect(canvas?.style.height).toBe('1000px')
})
