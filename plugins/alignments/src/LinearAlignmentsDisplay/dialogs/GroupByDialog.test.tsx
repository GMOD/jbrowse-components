import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MAX_GROUPS } from '../../shared/groupFeatures.ts'
import { layerForTest } from '../../shared/splitFieldForTest.ts'
import GroupByDialog from './GroupByDialog.tsx'
import { tagGroupingVerdict } from './tagGroupingVerdict.ts'

import type { BaseLayer, Facet } from '../../shared/types.ts'
import type { GroupByDialogModel } from './GroupByDialog.tsx'

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
  cleanup()
})

// The distinct-value scan needs a containing view and an RPC manager, which a
// bare model object is neither, so `settleScan` lands it in its error state,
// where Apply is left enabled: the verdict is advice the data supplies. The
// verdict itself is unit-tested below, and what Apply writes in
// `../groupByPlot.test.ts`.
const PLOT = { facet: { field: 'tags.HP' } }

function renderDialog(state: {
  colorField?: string
  solidColor?: string
  baseLayer?: BaseLayer
  facet?: Facet
}) {
  const applyGroupBy = jest.fn()
  const groupByPlot = jest.fn(() => PLOT)
  const openPlotDialog = jest.fn()
  const handleClose = jest.fn()
  const model = {
    id: 'display1',
    colorField: state.colorField,
    writtenColor: { value: state.solidColor },
    baseLayer: state.baseLayer,
    facet: state.facet,
    readFilter: {},
    resolvedByteLimit: () => undefined,
    applyGroupBy,
    groupByPlot,
    openPlotDialog,
  } as unknown as GroupByDialogModel
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupByDialog model={model} handleClose={handleClose} />
    </ThemeProvider>,
  )
  return { applyGroupBy, groupByPlot, openPlotDialog, handleClose }
}

const checkbox = () => screen.getByRole('checkbox') as HTMLInputElement

const applyButton = () => screen.getByText('Apply').closest('button')!

function typeTag(tag: string) {
  fireEvent.change(screen.getByTestId('group-tag-name-input'), {
    target: { value: tag },
  })
}

// Past the debounce and through the scan's settle.
async function settleScan() {
  await act(async () => {
    jest.advanceTimersByTime(500)
  })
}

function apply() {
  fireEvent.click(screen.getByText('Apply'))
}

// The box defaults against the tag in the box, not the one the model held
// when the dialog opened: reads colored by HP and grouped by nothing opened
// unticked, and applying reset the HP coloring.
test('typing the tag the reads are already colored by keeps that coloring', async () => {
  const { applyGroupBy } = renderDialog({ colorField: 'tags.HP' })
  expect(checkbox().checked).toBe(false)
  typeTag('HP')
  expect(checkbox().checked).toBe(true)
  await settleScan()
  apply()
  expect(applyGroupBy).toHaveBeenCalledWith('tags.HP', true)
})

test('a different tag coloring leaves the box unticked', async () => {
  const { applyGroupBy } = renderDialog({ colorField: 'tags.RG' })
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  await settleScan()
  apply()
  expect(applyGroupBy).toHaveBeenCalledWith('tags.HP', false)
})

test('a non-tag color field is not replaced by default', async () => {
  const { applyGroupBy } = renderDialog({
    colorField: 'insertSizeAndOrientation',
  })
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  await settleScan()
  apply()
  expect(applyGroupBy).toHaveBeenCalledWith('tags.HP', false)
})

// A solid color leaves `colorField` unset, as the plain fill does.
test('a solid color is not replaced by default', async () => {
  const { applyGroupBy } = renderDialog({ solidColor: 'red' })
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  await settleScan()
  apply()
  expect(applyGroupBy).toHaveBeenCalledWith('tags.HP', false)
})

// The plain fill under a per-base layer is the backdrop its calls read
// against, and the tag palette's blue and pink collide with the calls'.
test('the plain fill under a per-base layer is not replaced by default', async () => {
  const { applyGroupBy } = renderDialog({
    baseLayer: layerForTest({ field: 'modifications' }),
  })
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  await settleScan()
  apply()
  expect(applyGroupBy).toHaveBeenCalledWith('tags.HP', false)
})

// The guard this dialog exists for reads a scan that has not landed yet.
test('Apply is held until the scan settles', async () => {
  renderDialog({})
  typeTag('HP')
  expect(applyButton().disabled).toBe(true)
  await settleScan()
  expect(applyButton().disabled).toBe(false)
})

test('an uncolored track defaults to coloring by the grouped tag', async () => {
  const { applyGroupBy } = renderDialog({})
  typeTag('HP')
  expect(checkbox().checked).toBe(true)
  await settleScan()
  apply()
  expect(applyGroupBy).toHaveBeenCalledWith('tags.HP', true)
})

// Unticking pins: the default no longer re-ticks the box as the tag is edited.
test('unticking stays unticked as the tag is edited', async () => {
  const { applyGroupBy } = renderDialog({
    colorField: 'tags.HP',
    facet: { field: 'tags.HP' },
  })
  expect(checkbox().checked).toBe(true)
  fireEvent.click(checkbox())
  expect(checkbox().checked).toBe(false)
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  await settleScan()
  apply()
  expect(applyGroupBy).toHaveBeenCalledWith('tags.HP', false)
})

test('Edit plot... hands over the unapplied choice as a plot and applies nothing', () => {
  const { applyGroupBy, groupByPlot, openPlotDialog, handleClose } =
    renderDialog({})
  typeTag('HP')
  fireEvent.click(screen.getByText('Edit plot...'))
  expect(groupByPlot).toHaveBeenCalledWith('tags.HP', true)
  expect(openPlotDialog).toHaveBeenCalledWith(PLOT)
  expect(handleClose).toHaveBeenCalled()
  expect(applyGroupBy).not.toHaveBeenCalled()
})

// The scan's verdict, unit-tested rather than driven through the dialog: the
// lookup is debounced behind the box and goes out over an RPC, so reaching these
// states through the component would need a view and a worker to assert on four
// strings.
describe('tagGroupingVerdict', () => {
  // Nothing describes the tag in the box yet — the dialog is showing the scan's
  // error or its progress line, and this must not claim an answer over either.
  test('says nothing before a scan lands', () => {
    expect(tagGroupingVerdict('HP', undefined)).toBeUndefined()
  })

  // The end this dialog was built for: `tag` is the one dimension whose
  // cardinality the DATA decides. `>=` because reads LACKING the tag take a
  // section besides — see the function.
  test('refuses a tag that would flood the track with sections', () => {
    const many = Array.from({ length: MAX_GROUPS }, (_, i) => `${i}`)
    const verdict = tagGroupingVerdict('RX', many)
    expect(verdict?.blocks).toBe(true)
    expect(verdict?.text).toContain(`${MAX_GROUPS} distinct values`)

    expect(tagGroupingVerdict('RX', many.slice(0, -1))?.blocks).toBe(false)
  })

  // The other end, which used to fall through to no caption at all: every read
  // files under the '' sentinel, so the grouping draws one section named for a
  // tag nothing carries. Warned about rather than refused — the scan only sees
  // the blocks in view.
  test('warns when no read carries the tag, without refusing', () => {
    const verdict = tagGroupingVerdict('HP', [])
    expect(verdict?.blocks).toBe(false)
    expect(verdict?.color).toBe('warning.main')
    expect(verdict?.text).toContain('No read in view carries HP')
  })

  // The scan is the render fetch's download, so on a wide view the gate refuses
  // it exactly where the track beside it is refused. Said, not refused: the
  // grouping itself is fine, only the preview is unavailable.
  test('says so when the region is too large to scan, without refusing', () => {
    const verdict = tagGroupingVerdict('HP', { regionTooLarge: true })
    expect(verdict?.blocks).toBe(false)
    expect(verdict?.color).toBe('warning.main')
    expect(verdict?.text).toContain('too large to scan for HP values')
  })

  // Listed in the order the sections will stack, not the order the reads arrived.
  test('lists the found values in stacking order', () => {
    expect(tagGroupingVerdict('HP', ['10', '2', '1'])?.text).toBe(
      'Found values: 1, 2, 10',
    )
  })
})
