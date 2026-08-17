import { missingSlotNames } from './generateConfigDocs.ts'

import type { ManifestSlot } from './generateConfigDocs.ts'

// The rule assertManifestSlotsAreDocumented applies to one runtime slot. Each
// exemption here is a shape that is absent from a page by design; getting one
// wrong is silent in the direction that reads as fact, so they are pinned
// rather than left to the run that happens to notice.
const page = (...names: string[]) => new Set(names)

const slot = (name: string, type = 'string'): ManifestSlot => ({ name, type })

test('a slot with no row is named', () => {
  expect(missingSlotNames(slot('jexlFilters'), page())).toEqual(['jexlFilters'])
  expect(missingSlotNames(slot('jexlFilters'), page('jexlFilters'))).toEqual([])
})

test('the type discriminator is exempt', () => {
  expect(missingSlotNames(slot('type', '"BamAdapter"'), page())).toEqual([])
})

// By manifest type, not by name: HtsgetBamAdapter's `htsgetTrackId` is an
// ordinary string slot that the page does owe a row for.
test('identifier slots are exempt, `Id`-suffixed strings are not', () => {
  expect(missingSlotNames(slot('displayId', 'identifier'), page())).toEqual([])
  expect(missingSlotNames(slot('htsgetTrackId'), page())).toEqual([
    'htsgetTrackId',
  ])
})

describe('a container sub-schema', () => {
  const index: ManifestSlot = {
    name: 'index',
    type: 'BamIndexConfigurationSchema',
    subSlots: [slot('indexType'), slot('location')],
  }

  test('is covered by its own row', () => {
    expect(missingSlotNames(index, page('index'))).toEqual([])
  })

  test('is covered by every child', () => {
    expect(
      missingSlotNames(index, page('index.indexType', 'index.location')),
    ).toEqual([])
  })

  test('names the children it is missing', () => {
    expect(missingSlotNames(index, page('index.indexType'))).toEqual([
      'index.location',
    ])
    expect(missingSlotNames(index, page())).toEqual([
      'index.indexType',
      'index.location',
    ])
  })
})
