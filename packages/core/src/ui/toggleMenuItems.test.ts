import { withHint } from './toggleMenuItems.ts'

// The rows this serves can be on, correctly on, and doing nothing observable,
// so the hint has to be visible on the row itself rather than behind a hover —
// and absent the rest of the time, which is nearly always.
describe('withHint', () => {
  it('appends a hint parenthesized', () => {
    expect(withHint('Show coverage', 'zoom in')).toBe('Show coverage (zoom in)')
  })

  it('leaves the label untouched with no hint', () => {
    expect(withHint('Show coverage', undefined)).toBe('Show coverage')
  })

  // Docs and figure recipes click these rows by name, so the normal state has
  // to be the bare label and not an empty pair of parentheses.
  it('treats an empty hint as no hint', () => {
    expect(withHint('Show coverage', '')).toBe('Show coverage')
  })
})
