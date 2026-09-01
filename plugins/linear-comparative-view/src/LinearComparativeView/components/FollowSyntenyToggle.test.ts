import { followToggleTitle } from './FollowSyntenyToggle.tsx'

test('off, the tooltip says what turning it on does', () => {
  // the same words as the menu row, so the two read as one setting
  expect(followToggleTitle({ followSynteny: false })).toBe(
    'Follow - other rows track the anchor through the alignment',
  )
})

test('on, it names the row that is driving and how to stop', () => {
  // which row drives is the thing a user has to know while it is running, and
  // the button is the only place outside a menu that can say so
  expect(
    followToggleTitle({ followSynteny: true, anchorLabel: 'hg002mat' }),
  ).toBe('Following hg002mat — click to stop')
})

test('a row still loading its assembly does not leak an undefined', () => {
  expect(followToggleTitle({ followSynteny: true })).toBe(
    'Following the anchor row — click to stop',
  )
})

test('with one row there is nothing to follow, on or off', () => {
  expect(followToggleTitle({ followSynteny: false, rows: 1 })).toBe(
    'Add a second row to follow the anchor through the alignment',
  )
  expect(followToggleTitle({ followSynteny: true, rows: 1 })).toBe(
    'Add a second row to follow the anchor through the alignment',
  )
})

// the state a freshly built view is in, and the one every other sentence is
// untrue under: the mode was on, the tooltip said so, and nothing moved
test('a level with no synteny track says the rows have nothing to follow by', () => {
  expect(
    followToggleTitle({
      followSynteny: true,
      noSyntenyTrack: true,
      unaligned: true,
      anchorLabel: 'hg002mat',
    }),
  ).toBe(
    'Following hg002mat — a level has no synteny track, so its row has nothing to follow by',
  )
})

test('over unaligned sequence it says why the rows stopped moving', () => {
  // the case this exists for: a hap-specific insertion or a centromere leaves
  // the other rows holding, which is otherwise the same picture as a bug
  expect(
    followToggleTitle({
      followSynteny: true,
      unaligned: true,
      anchorLabel: 'hg002mat',
    }),
  ).toBe(
    'Following hg002mat — nothing aligns here, so the other rows are holding',
  )
})

test('the unaligned wording is only reachable while following', () => {
  expect(followToggleTitle({ followSynteny: false, unaligned: true })).toBe(
    'Follow - other rows track the anchor through the alignment',
  )
})

test('it says when the row was placed proportionally rather than walked', () => {
  // the ribbons are drawn the same way either way, so nothing else in the view
  // distinguishes an estimate from a walked answer
  expect(
    followToggleTitle({
      followSynteny: true,
      approximate: true,
      anchorLabel: 'hg002mat',
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
      anchorLabel: 'hg002mat',
    }),
  ).toBe(
    'Following hg002mat — nothing aligns here, so the other rows are holding',
  )
})

test('the approximate wording is only reachable while following', () => {
  expect(followToggleTitle({ followSynteny: false, approximate: true })).toBe(
    'Follow - other rows track the anchor through the alignment',
  )
})

// A row that is not showing everything the anchor aligns to has to say so, or
// the refusal is indistinguishable from the follow being wrong more quietly.
test('a refused multi-contig answer names both sides', () => {
  expect(
    followToggleTitle({
      followSynteny: true,
      partial: { following: 'chr1', elsewhere: ['chr9'] },
      anchorLabel: 'peach',
    }),
  ).toBe(
    'Following peach on chr1 — chr9 aligns too far away to show at once, so scroll onto it to follow that instead',
  )
})

// ahead of approximate, which is the ordinary condition of a zoomed-out view
// and so answers a question nobody is asking here
test('it outranks the approximate wording', () => {
  expect(
    followToggleTitle({
      followSynteny: true,
      approximate: true,
      partial: { following: 'chr1', elsewhere: ['chr9'] },
      anchorLabel: 'peach',
    }),
  ).toMatch(/scroll onto it/)
})

// nothing aligning at all is the louder state and stays first
test('but not the unaligned wording', () => {
  expect(
    followToggleTitle({
      followSynteny: true,
      unaligned: true,
      partial: { following: 'chr1', elsewhere: ['chr9'] },
      anchorLabel: 'peach',
    }),
  ).toMatch(/nothing aligns here/)
})
