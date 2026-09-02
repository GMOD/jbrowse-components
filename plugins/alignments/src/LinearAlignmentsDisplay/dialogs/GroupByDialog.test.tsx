import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MAX_GROUPS } from '../../shared/groupFeatures.ts'
import GroupByDialog from './GroupByDialog.tsx'
import { tagGroupingVerdict } from './tagGroupingVerdict.ts'

import type { ColorBy, GroupBy } from '../../shared/types.ts'
import type { GroupByDialogModel } from './GroupByDialog.tsx'

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
  cleanup()
})

// Only the tag/color surface is exercised here. The distinct-value scan needs a
// containing view and an RPC manager, which a bare model object is neither, so
// `settleScan` lands it in its error state — which is exactly the state Submit
// is deliberately left enabled in, since the verdict is advice the data supplies
// and without it the grouping is the one the menu would have applied anyway. The
// verdict itself is unit-tested below.
function renderDialog(state: { colorBy: ColorBy; groupBy?: GroupBy }) {
  const setGroupBy = jest.fn()
  const setColorScheme = jest.fn()
  const model = {
    id: 'display1',
    colorBy: state.colorBy,
    groupBy: state.groupBy,
    filterBy: {},
    resolvedByteLimit: () => undefined,
    setGroupBy,
    setColorScheme,
  } as unknown as GroupByDialogModel
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupByDialog model={model} handleClose={() => {}} />
    </ThemeProvider>,
  )
  return { setGroupBy, setColorScheme }
}

const checkbox = () => screen.getByRole('checkbox') as HTMLInputElement

const submitButton = () => screen.getByText('Submit').closest('button')!

function typeTag(tag: string) {
  fireEvent.change(screen.getByTestId('group-tag-name-input'), {
    target: { value: tag },
  })
}

// Past the debounce and through the scan's settle. Submit is held for the whole
// of it: the cardinality guard this dialog exists for reads the scan's answer,
// and a click landing before it arrived bypassed the guard outright.
async function settleScan() {
  await act(async () => {
    jest.advanceTimersByTime(500)
  })
}

function submit() {
  fireEvent.click(screen.getByText('Submit'))
}

// The box is a default until it is clicked, and the tag it defaults against is
// the one in the box — not the one the model held when the dialog opened. Reads
// already colored by HP, grouped by nothing: the box used to open unticked
// (there was no groupBy to compare against), and unticked means "don't color by
// this tag", so submitting reset the HP coloring the user could see.
test('typing the tag the reads are already colored by keeps that coloring', async () => {
  const { setGroupBy, setColorScheme } = renderDialog({
    colorBy: { type: 'tag', tag: 'HP' },
  })
  expect(checkbox().checked).toBe(false)
  typeTag('HP')
  expect(checkbox().checked).toBe(true)
  await settleScan()
  submit()
  expect(setGroupBy).toHaveBeenCalledWith({ type: 'tag', tag: 'HP' })
  expect(setColorScheme).toHaveBeenCalledWith({ type: 'tag', tag: 'HP' })
})

// A different tag's colors are in force, so the box stays a genuine offer to
// replace them and does nothing unless taken.
test('a different tag colouring leaves the box unticked and untouched', async () => {
  const { setColorScheme } = renderDialog({
    colorBy: { type: 'tag', tag: 'RG' },
  })
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  await settleScan()
  submit()
  expect(setColorScheme).not.toHaveBeenCalled()
})

// Every scheme but the plain one PAINTS something the checkbox would replace, so
// grouping by HP over a methylation or insert-size view used to turn that
// picture off on Submit.
test('a non-tag colour scheme is not replaced by default', async () => {
  const { setColorScheme } = renderDialog({
    colorBy: { type: 'modifications' },
  })
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  await settleScan()
  submit()
  expect(setColorScheme).not.toHaveBeenCalled()
})

// The guard this dialog exists for reads a scan that has not landed yet, so a
// click before it settles applied a grouping nothing had vetted.
test('Submit is held until the scan settles', async () => {
  renderDialog({ colorBy: { type: 'normal' } })
  typeTag('HP')
  expect(submitButton().disabled).toBe(true)
  await settleScan()
  expect(submitButton().disabled).toBe(false)
})

// Grouping by a tag usually pairs with coloring by it, so an uncolored track
// opts in by default.
test('an uncolored track defaults to coloring by the grouped tag', async () => {
  const { setColorScheme } = renderDialog({ colorBy: { type: 'normal' } })
  typeTag('HP')
  expect(checkbox().checked).toBe(true)
  await settleScan()
  submit()
  expect(setColorScheme).toHaveBeenCalledWith({ type: 'tag', tag: 'HP' })
})

// Unticking is still how you drop the coloring this dialog would set, and it
// pins: the default no longer re-ticks the box as the tag is edited.
test('unticking drops the matching coloring and stays unticked', async () => {
  const { setColorScheme } = renderDialog({
    colorBy: { type: 'tag', tag: 'HP' },
    groupBy: { type: 'tag', tag: 'HP' },
  })
  expect(checkbox().checked).toBe(true)
  fireEvent.click(checkbox())
  expect(checkbox().checked).toBe(false)
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  await settleScan()
  submit()
  expect(setColorScheme).toHaveBeenCalledWith({ type: 'normal' })
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
