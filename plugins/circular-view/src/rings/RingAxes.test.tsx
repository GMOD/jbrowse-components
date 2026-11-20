import { TEXT_BASELINE_RATIO } from '@jbrowse/display-ui'
import { render } from '@testing-library/react'

import { RingAxes } from './RingAxes.tsx'

const display = {
  id: 'd1',
  height: 50,
  configuredHeight: 50,
  setHostHeight: () => {},
  canvasDrawn: true,
  paintCount: 1,
  painted: true,
  renderNow: () => {},
  RenderingComponent: () => null,
  axes: [
    {
      bandTops: [0],
      ticks: {
        items: [
          { value: 0, y: 50, label: '0' },
          { value: 100, y: 0, label: '100' },
        ],
      },
    },
  ],
}

const model = {
  offsetRadians: 0,
  staticSlices: [{ endRadians: 2 * Math.PI - 0.6 }],
  ringHost: { rings: [{ display, innerPx: 60, outerPx: 110 }] },
}

function labelGroups() {
  const { container } = render(
    <svg>
      <RingAxes model={model} />
    </svg>,
  )
  return [...container.querySelectorAll('g[transform^="rotate"]')]
}

// `paint-order` is ignored by Skia and Qt, which paint the background stroke
// over the digits, and `dy` in ems by ImageMagick; a stroke copy under a fill
// copy on a baseline written into `y` reads the same in all of them
test('each tick label is a haloed pair centred on its tick by its own baseline', () => {
  const groups = labelGroups()
  expect(groups).toHaveLength(2)
  for (const g of groups) {
    const ly = Number(
      /rotate\(\S+ \S+ (\S+)\)/.exec(g.getAttribute('transform')!)![1],
    )
    const [halo, label] = [...g.querySelectorAll('text')]
    expect(halo?.getAttribute('stroke-width')).toBe('2.5')
    expect(label?.getAttribute('stroke')).toBeNull()
    expect(label?.closest('[stroke]')).toBeNull()
    for (const text of [halo, label]) {
      expect(text?.getAttribute('paint-order')).toBeNull()
      expect(text?.getAttribute('dy')).toBeNull()
      expect(Number(text?.getAttribute('y')) - ly).toBeCloseTo(
        9 * (TEXT_BASELINE_RATIO - 0.5),
      )
    }
  }
})
