import { categoricalField } from '@jbrowse/core/util/categoricalField'

import { knownSectionsOf, sectionSortOf } from './sectionHost.ts'

test('the known sections are those seen and those named, once each, in the field order', () => {
  const field = categoricalField('impact', { domain: ['HIGH', 'LOW'] })
  expect(
    knownSectionsOf(['LOW', 'MODERATE', 'LOW'], field, ['HIGH', 'MODERATE']),
  ).toEqual([
    { key: 'HIGH', label: 'HIGH' },
    { key: 'LOW', label: 'LOW' },
    { key: 'MODERATE', label: 'MODERATE' },
  ])
})

test('a reorder writes the sort only while a field splits the sections', () => {
  const host = {
    writtenFacet: {},
    setFacetSort: jest.fn(),
    hideGroup: jest.fn(),
    showAllGroups: jest.fn(),
    setHiddenGroups: jest.fn(),
    knownSections: [],
    hiddenGroups: new Set<string>(),
    sectionsHeading: 'Section',
  }
  expect(sectionSortOf(host)).toBeUndefined()
  const order = sectionSortOf({ ...host, writtenFacet: { field: 'impact' } })
  expect(order?.domain).toEqual([])
  order?.setDomain(['LOW'])
  expect(host.setFacetSort).toHaveBeenCalledWith(['LOW'])
})
