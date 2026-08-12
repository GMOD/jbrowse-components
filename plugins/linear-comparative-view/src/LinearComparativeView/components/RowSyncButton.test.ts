import { rowSyncButtonState } from './RowSyncButton.tsx'

const independent = { linkViews: false, followSynteny: false }
const linked = { linkViews: true, followSynteny: false }
const following = { linkViews: false, followSynteny: true }

test('one click cycles independent -> link -> follow -> independent', () => {
  // both couplings are one click from each other, and both are one click from
  // off — nothing traps the user in the mode that moves their rows
  expect(rowSyncButtonState(independent).next).toBe('link')
  expect(rowSyncButtonState(linked).next).toBe('follow')
  expect(rowSyncButtonState(following).next).toBe('independent')
})

test('the button reads as on for either coupling', () => {
  expect(rowSyncButtonState(independent).active).toBe(false)
  expect(rowSyncButtonState(linked).active).toBe(true)
  expect(rowSyncButtonState(following).active).toBe(true)
})

test('each tooltip names the mode that is on, not the one the click brings', () => {
  // the button is the only place a mode announces itself, so a tooltip that
  // described the pending click would report the wrong state
  expect(rowSyncButtonState(independent).title).toMatch(
    /^Rows move independently/,
  )
  expect(rowSyncButtonState(linked).title).toMatch(
    /^Rows share scroll and zoom/,
  )
  expect(rowSyncButtonState(following).title).toMatch(
    /^Rows follow the matching region/,
  )
})

test('following names the anchor row so a stack of three is not a guess', () => {
  expect(
    rowSyncButtonState({ ...following, anchorAssembly: 'hg002mat' }).title,
  ).toContain('in hg002mat')
})

test('an anchor row still loading its assembly drops the name rather than the tooltip', () => {
  const { title } = rowSyncButtonState(following)
  expect(title).toMatch(/^Rows follow the matching region —/)
  expect(title).not.toContain('undefined')
})
