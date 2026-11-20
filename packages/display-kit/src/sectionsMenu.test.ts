import { sectionsMenuItemsFor } from './sectionsMenu.ts'

import type { SectionsDialogModel } from './SectionsDialog.tsx'

function labels(sections: string[], hidden: string[] = []) {
  const model: SectionsDialogModel = {
    sectionsHeading: 'Strand',
    knownSections: sections.map(key => ({ key, label: key })),
    hiddenGroups: new Set(hidden),
    setHiddenGroups: () => {},
  }
  return sectionsMenuItemsFor({}, model).map(item =>
    'label' in item ? item.label : '',
  )
}

test('Sections... is offered only when it has a choice to make', () => {
  expect(labels([])).toEqual([])
  expect(labels(['a'])).toEqual([])
  expect(labels(['a'], ['a'])).toEqual(['Sections...'])
  expect(labels(['a', 'b'])).toEqual(['Sections...'])
})
