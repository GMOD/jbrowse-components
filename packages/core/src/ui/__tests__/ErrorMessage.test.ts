import { parseError } from '../parseError.ts'

describe('parseError', () => {
  it('returns undefined snapshotValue for non-MST errors', () => {
    const { snapshotValue, message } = parseError(
      'TypeError: cannot read property',
    )
    expect(snapshotValue).toBeUndefined()
    expect(message).toBe('')
  })

  it('handles case 2 (snapshot error without path)', () => {
    const str =
      'snapshot `{"type":"Track"}` is not assignable to type `ModelType`'
    const { snapshotValue, message } = parseError(str)
    expect(snapshotValue).toEqual({ type: 'Track' })
    expect(message).toBe('Snapshot:')
  })

  it('handles case 1 (snapshot error with path) and preserves path info', () => {
    const str =
      'at path "/configuration/displays/0" snapshot `{"type":"Display"}` is not assignable to type `ModelType`'
    const { snapshotValue, message } = parseError(str)
    expect(snapshotValue).toEqual({ type: 'Display' })
    expect(message).toBe('Snapshot at path "/configuration/displays/0":')
  })

  it('returns raw string when snapshot JSON is malformed', () => {
    const str = 'snapshot `not-valid-json` is not assignable to type `Foo`'
    const { snapshotValue, message } = parseError(str)
    expect(snapshotValue).toBe('not-valid-json')
    expect(message).toBe('Snapshot:')
  })
})
