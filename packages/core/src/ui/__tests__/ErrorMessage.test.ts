import { parseError } from '../ErrorBanner.tsx'

describe('parseError', () => {
  it('returns empty strings for non-MST errors', () => {
    const { snapshotError, message } = parseError('TypeError: cannot read property')
    expect(snapshotError).toBe('')
    expect(message).toBe('')
  })

  it('handles case 2 (snapshot error without path)', () => {
    const str = 'snapshot `{"type":"Track"}` is not assignable to type `ModelType`'
    const { snapshotError, message } = parseError(str)
    expect(snapshotError).toBe('{"type":"Track"}')
    expect(message).toBe('Failed to load element...Failed element had snapshot')
  })

  it('handles case 1 (snapshot error with path) and preserves path info', () => {
    const str =
      'at path "/configuration/displays/0" snapshot `{"type":"Display"}` is not assignable to type `ModelType`'
    const { snapshotError, message } = parseError(str)
    expect(snapshotError).toBe('{"type":"Display"}')
    expect(message).toBe(
      'Failed to load element at /configuration/displays/0...Failed element had snapshot',
    )
  })

  it('case 1 does not fall through to case 2 (path info is preserved)', () => {
    const str =
      'at path "/configuration/displays/0" snapshot `{"type":"Display"}` is not assignable to type `ModelType`'
    const { message } = parseError(str)
    expect(message).toContain('/configuration/displays/0')
  })
})
