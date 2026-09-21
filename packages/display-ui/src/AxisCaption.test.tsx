import { measureText } from '@jbrowse/core/util/measureText'
import { render } from '@testing-library/react'

import AxisCaption from './AxisCaption.tsx'
import AxisGutter from './AxisGutter.tsx'
import {
  AXIS_FONT_PX,
  CAPTION_BAND_PX,
  CAPTION_INSET_PX,
  TICK_LABEL_X_PX,
} from './yAxisConstants.ts'

import type { YAxis } from './valueScale.ts'

function axisLabelled(labels: string[], caption: string): YAxis {
  return {
    domain: [0, 1],
    scaleType: 'linear',
    height: 150,
    caption,
    ticks: {
      items: labels.map((label, i) => ({ value: i, y: 145 - i * 20, label })),
      yTop: 5,
      yBottom: 145,
    },
  }
}

function drawn(axis: YAxis, height: number) {
  const { container } = render(
    <svg>
      <AxisGutter axis={axis} />
      <AxisCaption axis={axis} bandTops={[0]} height={height} />
    </svg>,
  )
  const spine = Number(
    /translate\(([\d.]+)/.exec(
      container.querySelector('g')!.getAttribute('transform')!,
    )![1],
  )
  const caption = container.querySelector(':scope > svg > text')
  return {
    spine,
    captionX: Number(caption?.getAttribute('x')),
    caption: caption?.textContent,
  }
}

// Six-character labels and a caption do not share a 50px gutter, so the
// gutter grows in over the plot rather than drawing one over the other
test.each([['0.0005'], ['250000']])(
  'a caption keeps clear of %s-wide tick labels',
  label => {
    const axis = axisLabelled(['0', label], 'neg_log10_pvalue')
    const { spine, captionX } = drawn(axis, 150)
    const labelLeft = spine - TICK_LABEL_X_PX - measureText(label, AXIS_FONT_PX)
    expect(captionX).toBe(CAPTION_INSET_PX)
    expect(labelLeft).toBeGreaterThanOrEqual(CAPTION_BAND_PX)
  },
)

test('an uncaptioned gutter keeps its width', () => {
  expect(drawn(axisLabelled(['0', '250000'], ''), 150).spine).toBe(50)
})

// A caption longer than the display it stands in is cut, as a Vega-Lite title
// is at its limit, rather than clipped by the display's edges
test('a caption longer than its display is cut to fit it', () => {
  const axis = { ...axisLabelled(['0', '9'], 'neg_log10_pvalue'), height: 40 }
  const { caption } = drawn(
    {
      ...axis,
      ticks: { ...axis.ticks, yTop: 5, yBottom: 35 },
    },
    40,
  )
  expect(caption).toMatch(/^neg_.*…$/)
  expect(measureText(caption, AXIS_FONT_PX)).toBeLessThanOrEqual(40)
})
