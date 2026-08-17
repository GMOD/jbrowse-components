import { collapseSummary } from './CollapseIntronsDialog.tsx'

const CTG_A = { assemblyName: 'volvox', refName: 'ctgA' }

test('says how many regions and how much of the span survives', () => {
  expect(
    collapseSummary(
      {
        regions: [
          { ...CTG_A, start: 0, end: 300 },
          { ...CTG_A, start: 9800, end: 10_000 },
        ],
      },
      10_000,
    ),
  ).toBe(
    'Collapses to 2 regions — 500bp shown of the 10,000bp this feature spans',
  )
})

// The case the menu item's gate lets through: introns shorter than twice the
// window size merge away, so the collapse is a no-op and used to say nothing.
test('singular, and visibly a no-op, when the window merges every intron', () => {
  expect(
    collapseSummary({ regions: [{ ...CTG_A, start: 0, end: 1000 }] }, 1000),
  ).toBe(
    'Collapses to 1 region — 1,000bp shown of the 1,000bp this feature spans',
  )
})

test('passes an error straight through, for the dialog to show in red', () => {
  expect(
    collapseSummary({ error: 'No exons or CDS found to collapse' }, 0),
  ).toBe('No exons or CDS found to collapse')
})
