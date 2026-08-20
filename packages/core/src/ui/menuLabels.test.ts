import { withHint } from './menuLabels.ts'

// The rows this serves can be on, correctly on, and doing nothing observable,
// so the hint has to be visible on the row itself rather than behind a hover —
// and absent the rest of the time, which is nearly always.
describe('withHint', () => {
  it('appends a hint after an em dash', () => {
    expect(withHint('Show coverage', 'zoom in')).toBe('Show coverage — zoom in')
  })

  // Two of the real labels already end in a parenthetical of their own, which a
  // second pair straight after would read as a typo.
  it('does not double up on a label that already ends in parentheses', () => {
    expect(withHint('Show conservation (% identity)', 'zoom in')).toBe(
      'Show conservation (% identity) — zoom in',
    )
  })

  it('leaves the label untouched with no hint', () => {
    expect(withHint('Show coverage', undefined)).toBe('Show coverage')
  })

  // Docs and figure recipes click these rows by name, so the normal state has
  // to be the bare label and not a label with a dangling dash.
  it('treats an empty hint as no hint', () => {
    expect(withHint('Show coverage', '')).toBe('Show coverage')
  })
})
