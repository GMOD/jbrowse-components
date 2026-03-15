import { renameIds } from './copyView.ts'

describe('renameIds', () => {
  it('replaces id fields with new unique IDs', () => {
    const input = { id: 'abc123', name: 'test' }
    const result = renameIds(input)
    expect(result.id).not.toBe('abc123')
    expect(typeof result.id).toBe('string')
    expect(result.name).toBe('test')
  })

  it('generates consistent IDs for the same original ID', () => {
    const input = {
      items: [
        { id: 'shared-id', ref: 'shared-id' },
        { id: 'shared-id', ref: 'shared-id' },
      ],
    }
    const result = renameIds(input) as { items: { id: string }[] }
    expect(result.items[0]!.id).toBe(result.items[1]!.id)
  })

  it('generates different IDs for different original IDs', () => {
    const input = {
      items: [{ id: 'id-a' }, { id: 'id-b' }],
    }
    const result = renameIds(input) as { items: { id: string }[] }
    expect(result.items[0]!.id).not.toBe(result.items[1]!.id)
  })

  it('does not contain the original ID in the result', () => {
    const input = { id: 'original-id-value' }
    const result = renameIds(input)
    expect(result.id).not.toContain('original-id-value')
  })

  it('recursively processes nested objects', () => {
    const input = {
      id: 'outer',
      child: { id: 'inner', value: 42 },
    }
    const result = renameIds(input) as {
      id: string
      child: { id: string; value: number }
    }
    expect(result.id).not.toBe('outer')
    expect(result.child.id).not.toBe('inner')
    expect(result.child.value).toBe(42)
  })

  it('handles arrays of objects with ids', () => {
    const input = {
      levels: [
        { id: 'level-0', data: 'a' },
        { id: 'level-1', data: 'b' },
      ],
    }
    const result = renameIds(input) as {
      levels: { id: string; data: string }[]
    }
    expect(result.levels[0]!.id).not.toBe('level-0')
    expect(result.levels[1]!.id).not.toBe('level-1')
    expect(result.levels[0]!.id).not.toBe(result.levels[1]!.id)
    expect(result.levels[0]!.data).toBe('a')
  })

  it('preserves null and undefined values', () => {
    const input = { id: 'test', nullable: null, optional: undefined }
    const result = renameIds(input)
    expect(result.nullable).toBeNull()
    expect(result.optional).toBeUndefined()
  })

  it('only transforms string-valued id fields', () => {
    const input = { id: 42, name: 'test' }
    const result = renameIds(input as unknown as Record<string, unknown>)
    expect(result.id).toBe(42)
  })
})
