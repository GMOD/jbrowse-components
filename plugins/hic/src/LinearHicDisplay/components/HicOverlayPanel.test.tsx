import ChromeLegend from '@jbrowse/display-kit/ChromeLegend'
import { fireEvent, render } from '@testing-library/react'

import { createTestEnvironment } from '../testEnv.ts'
import { INSTANCE_STRIDE_WORDS } from './shaders/hic.iface.generated.ts'

import type { HicDataResult } from '../../RenderHicDataRPC/types.ts'

// One contact, which is all the scale needs: a positive `maxScore` is the
// whole gate on the color key.
const DATA: HicDataResult = {
  instances: new Float32Array(INSTANCE_STRIDE_WORDS),
  numContacts: 1,
  maxScore: 20,
  percentile95: 20,
  binWidth: 4,
  originBp: 0,
  resolution: 1000,
  appliedNormalization: 'KR',
  regions: [
    {
      refName: 'ctgA',
      dataXStart: 0,
      dataXEnd: 256,
      combinedOffset: 0,
      reversed: false,
    },
  ],
  pairRuns: [{ region1Idx: 0, region2Idx: 0, start: 0, end: 1 }],
}

const { createDisplay } = createTestEnvironment()

// The key is the chrome's, off `colorScales`: what these check is the scale
// this display declares and that the chrome's box draws it.
function renderLegend() {
  const { display } = createDisplay()
  display.setRpcData(DATA)
  display.setShowLegend(true)
  expect(display.colorScales).toHaveLength(1)
  return { display, ...render(<ChromeLegend model={display} />) }
}

test('no scale until the data lands with a positive saturation point', () => {
  const { display } = createDisplay()
  expect(display.colorScales).toEqual([])
  display.setRpcData(DATA)
  expect(display.colorScales[0]).toMatchObject({
    kind: 'ramp',
    id: 'contacts',
    title: 'Contacts',
    domain: [0, 20],
  })
})

test('the legend is the shared floating box', () => {
  const { getByTestId } = renderLegend()
  expect(getByTestId('floating-legend')).toBeTruthy()
})

test('the dismiss control is a plain × that turns the legend off', () => {
  const { display, getByLabelText } = renderLegend()
  const close = getByLabelText('Hide legend')
  expect(close.tagName).toBe('BUTTON')
  expect(close.textContent).toBe('×')

  fireEvent.click(close)
  expect(display.showLegend).toBe(false)
})

test('the gradient bar is a row of the box, captioned and labelled', () => {
  const { getByTestId, getByText } = renderLegend()
  const bar = getByTestId('floating-legend').querySelector<HTMLElement>(
    '[style*="linear-gradient"]',
  )
  expect(bar).toBeTruthy()
  getByText('Contacts')
  getByText('0')
  getByText('20')
})
