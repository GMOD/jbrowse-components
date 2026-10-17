import { collapseSectionsItems } from './groupByMenu.ts'

function makeModel(opts?: {
  canCollapseSections?: boolean
  collapseSections?: boolean
}) {
  const setCollapseSections = jest.fn()
  return {
    model: {
      canCollapseSections: opts?.canCollapseSections ?? true,
      collapseSections: opts?.collapseSections ?? false,
      setCollapseSections,
    },
    setCollapseSections,
  }
}

test('grouped, it offers one checkbox that reflects the setting', () => {
  const items = collapseSectionsItems(
    makeModel({ collapseSections: true }).model,
  )
  expect(items.map(i => i.label)).toEqual(['Collapse groups to one row'])
  expect(items[0]!.checked).toBe(true)
})

test('clicking writes the flipped value', () => {
  const { model, setCollapseSections } = makeModel()
  collapseSectionsItems(model)[0]!.onClick()
  expect(setCollapseSections).toHaveBeenCalledWith(true)
})

// Ungrouped (and in chain mode) the display's `collapseSections` getter reads
// false whatever the slot says, so a visible box would sit unchecked on a track
// that defaults it on (LGVSyntenyDisplay) and clicking it would change nothing.
// Omitted, not disabled.
test('it is absent when collapsing cannot take effect', () => {
  expect(
    collapseSectionsItems(
      makeModel({ canCollapseSections: false, collapseSections: true }).model,
    ),
  ).toEqual([])
})
