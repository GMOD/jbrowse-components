import { collapseGroupRowsItems } from './groupByMenu.ts'

function makeModel(opts?: {
  canCollapseGroupRows?: boolean
  collapseGroupRows?: boolean
}) {
  const setCollapseGroupRows = jest.fn()
  return {
    model: {
      canCollapseGroupRows: opts?.canCollapseGroupRows ?? true,
      collapseGroupRows: opts?.collapseGroupRows ?? false,
      setCollapseGroupRows,
    },
    setCollapseGroupRows,
  }
}

test('grouped, it offers one checkbox that reflects the setting', () => {
  const items = collapseGroupRowsItems(
    makeModel({ collapseGroupRows: true }).model,
  )
  expect(items.map(i => i.label)).toEqual(['Collapse groups to one row'])
  expect(items[0]!.checked).toBe(true)
})

test('clicking writes the flipped value', () => {
  const { model, setCollapseGroupRows } = makeModel()
  collapseGroupRowsItems(model)[0]!.onClick()
  expect(setCollapseGroupRows).toHaveBeenCalledWith(true)
})

// Ungrouped (and in chain mode) the display's `collapseGroupRows` getter reads
// false whatever the slot says, so a visible box would sit unchecked on a track
// that defaults it on (LGVSyntenyDisplay) and clicking it would change nothing.
// Omitted, not disabled.
test('it is absent when collapsing cannot take effect', () => {
  expect(
    collapseGroupRowsItems(
      makeModel({ canCollapseGroupRows: false, collapseGroupRows: true }).model,
    ),
  ).toEqual([])
})
