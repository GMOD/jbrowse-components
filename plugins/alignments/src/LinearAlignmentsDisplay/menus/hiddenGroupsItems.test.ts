import { hiddenGroupsItems } from './groupByMenu.ts'

// Absent while nothing is hidden: a row reading "Show 0 hidden groups" is a row
// about a feature most tracks never touch.
test('offers nothing while every lane is drawn', () => {
  expect(
    hiddenGroupsItems({ hiddenGroups: new Set(), showAllGroups: jest.fn() }),
  ).toEqual([])
})

// The count is in the label because a hidden lane draws no chip — the row is
// the only place the stack says a lane is missing.
test('names how many lanes are hidden and puts them all back', () => {
  const showAllGroups = jest.fn()
  const one = hiddenGroupsItems({ hiddenGroups: new Set(['+']), showAllGroups })
  expect(one[0]!.label).toBe('Show 1 hidden group')
  one[0]!.onClick()
  expect(showAllGroups).toHaveBeenCalled()

  expect(
    hiddenGroupsItems({
      hiddenGroups: new Set(['+', '-']),
      showAllGroups,
    })[0]!.label,
  ).toBe('Show 2 hidden groups')
})
