import { types } from '@jbrowse/mobx-state-tree'
import { render } from '@testing-library/react'

import { renderDisplaySvg } from './renderDisplaySvg.tsx'

import type { LgvSvgBodyProps } from './renderDisplaySvg.tsx'
import type { YAxis } from '@jbrowse/display-ui'

// The shell is the one place the export's canvas geometry and terminal gating are
// decided, and both failures it prevents are invisible in a snapshot: painting at
// the on-screen `trackWidthPx` clips the rightmost 2px column (shipped once, in
// LinearMultiRowFeatureDisplay), and a body that runs under a terminal state
// re-detects the terminal from empty data. Only 3 of the 9 LGV displays have an
// export snapshot at all, so pinning the contract here covers the other six.

// `isViewModel` is duck-typed on `width` + `setWidth`, so this is all
// `getContainingView` needs to resolve the display's parent.
const TestView = types
  .model('TestView', {
    display: types.model('TestDisplay', {
      id: types.optional(types.string, 'test-display'),
      height: types.optional(types.number, 100),
      svgReady: types.optional(types.boolean, true),
      regionTooLarge: types.optional(types.boolean, false),
      hasError: types.optional(types.boolean, false),
    }),
  })
  .volatile(() => ({
    width: 808,
    // the on-screen render width every display puts in `renderState`: the
    // viewport minus the 2px track outline the export never draws
    trackWidthPx: 806,
    offsetPx: 0,
    visibleRegions: [] as { screenEndPx: number }[],
  }))
  .actions(self => ({
    setWidth(n: number) {
      self.width = n
    },
    setOffsetPx(n: number) {
      self.offsetPx = n
    },
  }))

type TestDisplayModel = ReturnType<typeof TestView.create>['display'] & {
  error: unknown
}

function makeDisplay(snap: { regionTooLarge?: boolean; hasError?: boolean }) {
  const view = TestView.create({ display: { ...snap } })
  // `error` is `unknown` on SvgExportable; MST can't hold that, so derive it
  // from the boolean the model does store.
  return Object.create(view.display, {
    error: { value: snap.hasError ? new Error('boom') : undefined },
  }) as TestDisplayModel
}

async function renderShell(
  model: TestDisplayModel,
  seen: LgvSvgBodyProps<TestDisplayModel>[],
) {
  function Body(props: LgvSvgBodyProps<TestDisplayModel>) {
    seen.push(props)
    return <g data-testid="body" />
  }
  const node = await renderDisplaySvg(model, undefined, Body)
  return render(<svg>{node}</svg>)
}

test('hands the body view.width, never the outline-adjusted trackWidthPx', async () => {
  const seen: LgvSvgBodyProps<TestDisplayModel>[] = []
  const { getByTestId } = await renderShell(makeDisplay({}), seen)

  expect(getByTestId('body')).toBeTruthy()
  expect(seen).toHaveLength(1)
  expect(seen[0]!.canvasWidth).toBe(808)
  expect(seen[0]!.canvasWidth).not.toBe(seen[0]!.view.trackWidthPx)
  expect(seen[0]!.height).toBe(100)
})

test('does not run the body under the region-too-large terminal', async () => {
  const seen: LgvSvgBodyProps<TestDisplayModel>[] = []
  const { queryByTestId } = await renderShell(
    makeDisplay({ regionTooLarge: true }),
    seen,
  )

  expect(seen).toHaveLength(0)
  expect(queryByTestId('body')).toBeNull()
})

// The error terminal is the one the shell refuses to draw: a figure is a
// standalone artifact, so a track whose data wouldn't load fails the export
// rather than exporting a labeled box in the space that track was going to fill.
test('fails the export on the error terminal instead of drawing it', async () => {
  const seen: LgvSvgBodyProps<TestDisplayModel>[] = []
  await expect(
    renderShell(makeDisplay({ hasError: true }), seen),
  ).rejects.toThrow('Cannot export: Error: boom')

  expect(seen).toHaveLength(0)
})

// The shell draws the axis of a display declaring a `valueScale` off the
// ticks its mixin derived — the y-axis counterpart of the legend — and nothing
// for a host whose scale is unset, which is how a display with several axes
// (the multi-wiggle's rows) keeps its own.
describe('the y axis', () => {
  const ticks = {
    items: [
      { value: 0, y: 95 },
      { value: 10, y: 5 },
    ],
    yTop: 5,
    yBottom: 95,
  }
  const scale = (over: Partial<YAxis> = {}): YAxis => ({
    domain: [0, 10],
    scaleType: 'linear',
    height: 100,
    ticks,
    ...over,
  })
  function axisHost(
    axes: YAxis[],
    { showCrossHatches = false, offsetPx = 0 } = {},
  ) {
    const view = TestView.create({ display: {} })
    view.setOffsetPx(offsetPx)
    return Object.create(view.display, {
      error: { value: undefined },
      axes: { value: axes },
      canvasWidthPx: { value: 806 },
      showCrossHatches: { value: showCrossHatches },
    }) as TestDisplayModel
  }
  const labelsOf = (container: HTMLElement) =>
    [...container.querySelectorAll('text')].map(t => t.textContent)
  // Absolute x of each tick label: `YScaleBar` grows its labels away from the
  // spine, so the local x is signed and only the enclosing translates make it
  // absolute.
  function labelXs(container: HTMLElement) {
    return [...container.querySelectorAll('text')].map(t => {
      let x = Number(t.getAttribute('x'))
      for (
        let node = t.parentElement;
        node && node !== container;
        node = node.parentElement
      ) {
        const dx = /translate\((-?[\d.]+)/.exec(
          node.getAttribute('transform') ?? '',
        )?.[1]
        x += Number(dx ?? 0)
      }
      return x
    })
  }

  test('a declared scale places the axis in the margin at the content edge, with hatches when shown', async () => {
    const { container } = await renderShell(
      axisHost([scale()], { showCrossHatches: true }),
      [],
    )
    expect(labelsOf(container)).toEqual(['0', '10'])
    expect(container.querySelectorAll('line').length).toBeGreaterThanOrEqual(4)
    for (const x of labelXs(container)) {
      expect(x).toBeLessThan(0)
      expect(x).toBeGreaterThan(-50)
    }
  })

  test('no declared scale draws no axis', async () => {
    const { container } = await renderShell(
      axisHost([], { showCrossHatches: true }),
      [],
    )
    expect(container.querySelectorAll('text')).toHaveLength(0)
    expect(container.querySelectorAll('line')).toHaveLength(0)
  })

  // Scrolled before the genome start, the content edge moves right and the
  // axis follows it.
  test('follows the content edge when scrolled before the genome start', async () => {
    const at0 = labelXs((await renderShell(axisHost([scale()]), [])).container)
    const at30 = labelXs(
      (await renderShell(axisHost([scale()], { offsetPx: -30 }), [])).container,
    )
    expect(at30[0]! - at0[0]!).toBe(30)
  })

  // A grouped alignments track draws its coverage axis on the right so it
  // clears the group label chips at the left edge: past the midpoint, and
  // still inside the image.
  test('a right-side scale sits inside the right edge, clear of the left', async () => {
    const { container } = await renderShell(
      axisHost([scale({ side: 'right' })]),
      [],
    )
    const xs = labelXs(container)
    expect(xs.length).toBeGreaterThan(0)
    for (const x of xs) {
      expect(x).toBeGreaterThan(806 / 2)
      expect(x).toBeLessThanOrEqual(806)
    }
  })

  // A panel at the left (the dendrogram) pushes the gutter inside the image,
  // past the panel, instead of into the margin.
  test('a scale with a panel at the left starts its gutter past it', async () => {
    const { container } = await renderShell(axisHost([scale({ left: 40 })]), [])
    for (const x of labelXs(container)) {
      expect(x).toBeGreaterThan(40)
      expect(x).toBeLessThan(90)
    }
  })

  test('a scale ruling several bands gets an axis per band', async () => {
    const { container } = await renderShell(
      axisHost([scale({ height: 40, bandTops: [0, 60] })]),
      [],
    )
    expect(labelsOf(container)).toEqual(['0', '10', '0', '10'])
    expect(
      [...container.querySelectorAll('g[transform]')]
        .map(g => g.getAttribute('transform'))
        .filter(t => t?.startsWith('translate(-50')),
    ).toEqual(['translate(-50 0)', 'translate(-50 60)'])
  })

  // Both ends of the caption come off the scale's own domain, so a log-scaled
  // coverage band floored at one read reads "[1, …]" and says it is log.
  test('a scale too short for an axis is captioned at the top-right', async () => {
    const { container } = await renderShell(
      axisHost([scale({ domain: [1, 128], scaleType: 'log', height: 20 })]),
      [],
    )
    expect(labelsOf(container)).toEqual(['[1, 128] (log)'])
    const x = Number(container.querySelector('text')?.getAttribute('x'))
    expect(x).toBeGreaterThan(806 / 2)
    expect(x).toBeLessThanOrEqual(806)
  })

  test('a scale with a caption names its axis beside it', async () => {
    const { container } = await renderShell(
      axisHost([scale({ side: 'right', caption: 'TLEN' })]),
      [],
    )
    expect(labelsOf(container)).toEqual(['0', '10', 'TLEN'])
  })

  // The chrome stacks the key over the axis on screen; a right-side axis and
  // the key share the top-right corner, so the export keeps the same order.
  test('the key draws over the axis, as on screen', async () => {
    const host = axisHost([scale({ side: 'right' })])
    const model = Object.create(host, {
      showLegend: { value: true },
      legendSpec: {
        value: { items: [{ id: 'a', label: 'a', color: 'red' }] },
      },
      setShowLegend: { value: () => {} },
    }) as TestDisplayModel
    const { container } = await renderShell(model, [])
    const legend = container.querySelector('[data-testid="color-legend"]')!
    const axisLabel = [...container.querySelectorAll('text')].find(
      t => !legend.contains(t),
    )!
    expect(
      axisLabel.compareDocumentPosition(legend) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
