import { resolveRowOrder } from './executeMafAlignmentData.ts'

const samples = ['ce11', 'caePb3', 'caeRem4', 'cb4'].map(id => ({
  id,
  label: id,
}))

test('client order wins when the display has one', () => {
  expect(resolveRowOrder(samples, ['cb4', 'ce11'], ['caePb3'])).toEqual([
    'cb4',
    'ce11',
  ])
})

test('no order and no filter is every sample, canonically', () => {
  expect(resolveRowOrder(samples, undefined, undefined)).toEqual([
    'ce11',
    'caePb3',
    'caeRem4',
    'cb4',
  ])
})

// The discovery fetch: a session that loads with a subtree filter already set
// has no display order to send, and without this the dropped row still came
// back and every row drew against the label above it.
test('the filter applies on the fetch that has no display order yet', () => {
  expect(
    resolveRowOrder(samples, undefined, ['caePb3', 'caeRem4', 'cb4']),
  ).toEqual(['caePb3', 'caeRem4', 'cb4'])
})

test('the filter keeps canonical order, not its own', () => {
  expect(resolveRowOrder(samples, undefined, ['cb4', 'caePb3'])).toEqual([
    'caePb3',
    'cb4',
  ])
})

test('an empty order falls through to the filter', () => {
  expect(resolveRowOrder(samples, [], ['cb4'])).toEqual(['cb4'])
})
