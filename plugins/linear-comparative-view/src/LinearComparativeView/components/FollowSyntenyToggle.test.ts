import { followToggleTitle } from './FollowSyntenyToggle.tsx'

test('off, the tooltip says what turning it on does', () => {
  // the same words as the menu row, so the two read as one setting
  expect(followToggleTitle({ followSynteny: false })).toBe(
    'Follow the matching region',
  )
})

test('on, it names the row that is driving and how to stop', () => {
  // which row drives is the thing a user has to know while it is running, and
  // the button is the only place outside a menu that can say so
  expect(
    followToggleTitle({ followSynteny: true, anchorAssembly: 'hg002mat' }),
  ).toBe('Following hg002mat — click to stop')
})

test('a row still loading its assembly does not leak an undefined', () => {
  expect(followToggleTitle({ followSynteny: true })).toBe(
    'Following the anchor row — click to stop',
  )
})

test('over unaligned sequence it says why the rows stopped moving', () => {
  // the case this exists for: a hap-specific insertion or a centromere leaves
  // the other rows holding, which is otherwise the same picture as a bug
  expect(
    followToggleTitle({
      followSynteny: true,
      unaligned: true,
      anchorAssembly: 'hg002mat',
    }),
  ).toBe(
    'Following hg002mat — nothing aligns here, so the other rows are holding',
  )
})

test('the unaligned wording is only reachable while following', () => {
  expect(followToggleTitle({ followSynteny: false, unaligned: true })).toBe(
    'Follow the matching region',
  )
})

test('it says when the row was placed proportionally rather than walked', () => {
  // zoomed out past one alignment, or on a CIGAR-less tier, the position is an
  // estimate — and nothing else in the view distinguishes that from the exact
  // case, since the ribbons are drawn the same way either way
  expect(
    followToggleTitle({
      followSynteny: true,
      approximate: true,
      anchorAssembly: 'hg002mat',
    }),
  ).toBe(
    'Following hg002mat — no per-base alignment at this zoom, so positions are approximate',
  )
})

test('holding beats estimating, since a held row was never placed', () => {
  expect(
    followToggleTitle({
      followSynteny: true,
      unaligned: true,
      approximate: true,
      anchorAssembly: 'hg002mat',
    }),
  ).toBe(
    'Following hg002mat — nothing aligns here, so the other rows are holding',
  )
})

test('the approximate wording is only reachable while following', () => {
  expect(followToggleTitle({ followSynteny: false, approximate: true })).toBe(
    'Follow the matching region',
  )
})
