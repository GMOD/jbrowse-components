import { types } from '@jbrowse/mobx-state-tree'
import { render } from '@testing-library/react'

import { renderDisplaySvg } from './renderDisplaySvg.tsx'

import type { LgvSvgBodyProps } from './renderDisplaySvg.tsx'

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
