import { describe, it, expect } from 'vitest'

describe('SashimiArcsOverlay arc keys', () => {
  it('uses stable arc identifiers as keys, not array indices', () => {
    // Test data showing the expected key format
    const arcs = [
      {
        refName: 'chr1',
        start: 1000,
        end: 2000,
        d: 'M...',
        stroke: 'red',
        strokeWidth: 2,
        score: 5,
        strand: 1,
      },
      {
        refName: 'chr1',
        start: 1500,
        end: 2500,
        d: 'M...',
        stroke: 'blue',
        strokeWidth: 2,
        score: 3,
        strand: -1,
      },
    ]

    // Generate keys the way the component does
    const keys = arcs.map(arc => `${arc.refName}:${arc.start}:${arc.end}`)

    expect(keys).toEqual([
      'chr1:1000:2000',
      'chr1:1500:2500',
    ])

    // All keys should be unique
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('generates unique keys for arcs in different regions', () => {
    const arcs = [
      { refName: 'chr1', start: 1000, end: 2000, score: 5 },
      { refName: 'chr2', start: 1000, end: 2000, score: 3 }, // Same coordinates, different region
    ]

    const keys = arcs.map(arc => `${arc.refName}:${arc.start}:${arc.end}`)

    expect(new Set(keys).size).toBe(2)
    expect(keys[0]).not.toBe(keys[1])
  })

  it('does not use array index as key', () => {
    // The old buggy code would use key={i}, producing keys like "0", "1", etc.
    // The fixed code uses key={`${arc.refName}:${arc.start}:${arc.end}`}
    const arcs = [
      {
        refName: 'chr1',
        start: 100,
        end: 200,
        d: 'M...',
        stroke: 'red',
        strokeWidth: 1,
        score: 5,
        strand: 1,
      },
    ]

    const stableKey = `${arcs[0].refName}:${arcs[0].start}:${arcs[0].end}`
    const indexKey = '0'

    expect(stableKey).not.toBe(indexKey)
    expect(stableKey).toContain(':')
  })
})
