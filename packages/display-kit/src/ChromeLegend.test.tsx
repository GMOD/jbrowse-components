import { render } from '@testing-library/react'

import ChromeLegend from './ChromeLegend.tsx'

import type { LegendHost } from './legendHost.ts'

function host(clearance: Pick<LegendHost, 'legendRight' | 'legendTop'>) {
  return {
    showLegend: true,
    legendSpec: {
      sections: [{ id: 'a', items: [{ label: 'a', color: 'red' }] }],
    },
    setShowLegend() {},
    dismissLegendSection() {},
    ...clearance,
  } as unknown as LegendHost
}

function belowLabel(px: number) {
  return `calc(${px}px - var(--track-label-band, 0px))`
}

test('a display clears its own corner text by pushing the key left', () => {
  const { getByTestId, rerender } = render(<ChromeLegend model={host({})} />)
  const { style } = getByTestId('floating-legend')
  expect([style.top, style.right]).toEqual([belowLabel(10), '10px'])

  rerender(<ChromeLegend model={host({ legendRight: 70 })} />)
  const moved = getByTestId('floating-legend').style
  expect([moved.top, moved.right]).toEqual([belowLabel(10), '80px'])
})

test('a display clears its top rows by pushing the key down', () => {
  const { getByTestId } = render(
    <ChromeLegend model={host({ legendTop: 60 })} />,
  )
  const { style } = getByTestId('floating-legend')
  expect([style.top, style.right]).toEqual([belowLabel(70), '10px'])
})

test('a hidden legend never derives its key', () => {
  const model = {
    showLegend: false,
    get legendSpec(): never {
      throw new Error('derived the key of a hidden legend')
    },
  } as unknown as LegendHost
  const { queryByTestId } = render(<ChromeLegend model={model} />)
  expect(queryByTestId('floating-legend')).toBeNull()
})
