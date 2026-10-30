import { TrackOverlaySlot } from '@jbrowse/display-ui'
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

test('a display clears its own corner text by pushing the key left', () => {
  const { getByTestId, rerender } = render(<ChromeLegend model={host({})} />)
  const { style } = getByTestId('floating-legend')
  expect([style.top, style.right]).toEqual(['10px', '10px'])

  rerender(<ChromeLegend model={host({ legendRight: 70 })} />)
  const moved = getByTestId('floating-legend').style
  expect([moved.top, moved.right]).toEqual(['10px', '80px'])
})

test('a display clears its top rows by pushing the key down', () => {
  const { getByTestId } = render(
    <ChromeLegend model={host({ legendTop: 60 })} />,
  )
  const { style } = getByTestId('floating-legend')
  expect([style.top, style.right]).toEqual(['70px', '10px'])
})

// The key climbs beside an in-flow track label only from the display's top
// edge; one a display pushed down under its own content stays under it.
test('a key pushed down does not climb into the track label band', () => {
  const inSlot = (legendTop?: number) => {
    const { getByTestId, unmount } = render(
      <TrackOverlaySlot zIndex={1} labelBand={30}>
        <ChromeLegend model={host({ legendTop })} />
      </TrackOverlaySlot>,
    )
    const { top } = getByTestId('floating-legend').style
    unmount()
    return top
  }
  expect(inSlot(60)).toBe('70px')
  expect(inSlot()).toBe('-20px')
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
