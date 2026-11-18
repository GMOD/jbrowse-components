import { TrackOverlaySlot } from '@jbrowse/display-ui'
import { act, render } from '@testing-library/react'
import { observable, runInAction } from 'mobx'

import ChromeLegend from './ChromeLegend.tsx'

import type { LegendHost } from './legendHost.ts'
import type { FloatingLegend, YAxis } from '@jbrowse/display-ui'
import type { ComponentProps } from 'react'

const mockLegendRenders = { count: 0 }

jest.mock('@jbrowse/display-ui', () => {
  const actual = jest.requireActual<{ FloatingLegend: typeof FloatingLegend }>(
    '@jbrowse/display-ui',
  )
  const Actual = actual.FloatingLegend
  return {
    ...actual,
    FloatingLegend: function CountedFloatingLegend(
      props: ComponentProps<typeof Actual>,
    ) {
      mockLegendRenders.count += 1
      return <Actual {...props} />
    },
  }
})

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

// The key climbs beside an in-flow track label, but never back over content
// the display pushed it under: it rises by what the push leaves of the band,
// so a key pushed down by a scrolling lane moves smoothly rather than jumping.
test('a key pushed down climbs only by what the push leaves of the label band', () => {
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
  expect(inSlot(30)).toBe('40px')
  expect(inSlot(10)).toBe('0px')
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

// A mark display with rows rebuilds `axes` from its scroll offset, so a fresh
// array arrives on every vertical-scroll frame with the same captions in it.
test('a fresh axes array with the same captions does not re-render the key', () => {
  const captioned = (offset: number): YAxis => ({
    domain: [0, 1],
    scaleType: 'linear',
    height: 10,
    bandTops: [offset],
    ticks: { items: [], yTop: 0, yBottom: 10 },
  })
  const model = observable({
    id: 'display1',
    showLegend: true,
    legendSpec: {
      sections: [{ id: 'a', items: [{ label: 'a', color: 'red' }] }],
    },
    axes: [captioned(0)],
    height: 100,
    canvasWidthPx: 800,
    setShowLegend() {},
    dismissLegendSection() {},
  })
  const { getByTestId } = render(<ChromeLegend model={model} />)
  expect(getByTestId('floating-legend').style.top).toBe('26px')
  const before = mockLegendRenders.count

  for (let scrollTop = 1; scrollTop <= 5; scrollTop++) {
    act(() => {
      runInAction(() => {
        model.axes = [captioned(-scrollTop)]
      })
    })
  }
  expect(mockLegendRenders.count).toBe(before)
  expect(getByTestId('floating-legend').style.top).toBe('26px')

  act(() => {
    runInAction(() => {
      model.axes = [captioned(0), captioned(20)]
    })
  })
  expect(getByTestId('floating-legend').style.top).toBe('42px')
})
