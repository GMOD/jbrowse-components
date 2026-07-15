import { countNonGapBases, parseLineByLine } from './testFixtures.ts'

describe('countNonGapBases', () => {
  test('counts all bases when no gaps', () => {
    expect(countNonGapBases('ACGTACGT')).toBe(8)
  })

  test('excludes gap characters', () => {
    expect(countNonGapBases('AC-GT-ACGT')).toBe(8)
  })

  test('excludes space characters', () => {
    expect(countNonGapBases('AC GT ACGT')).toBe(8)
  })

  test('handles all gaps', () => {
    expect(countNonGapBases('----')).toBe(0)
  })

  test('handles empty string', () => {
    expect(countNonGapBases('')).toBe(0)
  })

  test('handles mixed case', () => {
    expect(countNonGapBases('AcGt-acgt')).toBe(8)
  })

  test('handles real alignment sequence with many gaps', () => {
    expect(countNonGapBases('TTT-T-T--')).toBe(5)
  })
})

describe('parseLineByLine', () => {
  test('parses simple lines', () => {
    const buffer = new TextEncoder().encode('line1\nline2\nline3\n')
    const lines: string[] = []
    parseLineByLine(buffer, line => {
      lines.push(line)
      return undefined
    })
    expect(lines).toEqual(['line1', 'line2', 'line3'])
  })

  test('handles Windows line endings', () => {
    const buffer = new TextEncoder().encode('line1\r\nline2\r\n')
    const lines: string[] = []
    parseLineByLine(buffer, line => {
      lines.push(line)
      return undefined
    })
    // The \r gets trimmed
    expect(lines).toEqual(['line1', 'line2'])
  })

  test('skips empty lines', () => {
    const buffer = new TextEncoder().encode('line1\n\nline2\n')
    const lines: string[] = []
    parseLineByLine(buffer, line => {
      lines.push(line)
      return undefined
    })
    expect(lines).toEqual(['line1', 'line2'])
  })

  test('collects return values', () => {
    const buffer = new TextEncoder().encode('1\n2\n3\n')
    const results = parseLineByLine(buffer, line => {
      const num = parseInt(line, 10)
      return num > 1 ? num * 2 : undefined
    })
    expect(results).toEqual([4, 6])
  })
})
