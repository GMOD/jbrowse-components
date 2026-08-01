import {
  groupLinesByRef,
  makeFeatureIntervalTreeMap,
  parseLineByLine,
} from './parseLineByLine.ts'

describe('parseLineByLine', () => {
  it('should call callback for each line', () => {
    const content = `line1
line2
line3`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(buffer, line => {
      lines.push(line)
      return true
    })

    expect(lines).toEqual(['line1', 'line2', 'line3'])
  })

  it('should stop parsing when callback returns false', () => {
    const content = `line1
line2
line3
line4`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(buffer, line => {
      lines.push(line)
      if (line === 'line2') {
        return false
      }
      return true
    })

    expect(lines).toEqual(['line1', 'line2'])
  })

  it('should handle empty lines', () => {
    const content = `line1

line3`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(buffer, line => {
      lines.push(line)
      return true
    })

    expect(lines).toEqual(['line1', 'line3'])
  })

  it('should handle file without trailing newline', () => {
    const content = `line1
line2`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(buffer, line => {
      lines.push(line)
      return true
    })

    expect(lines).toEqual(['line1', 'line2'])
  })

  it('should call status callback during parsing', () => {
    const content = `line1
line2`
    const buffer = new TextEncoder().encode(content)
    const mockStatusCallback = jest.fn()

    parseLineByLine(
      buffer,
      () => {
        return true
      },
      mockStatusCallback,
    )

    // determinate progress: a StatusWithProgress object carrying byte offset
    // (current) against the buffer size (total), not a baked percentage string
    expect(mockStatusCallback).toHaveBeenCalledWith({
      message: 'Loading',
      current: expect.any(Number),
      total: buffer.length,
    })
  })

  it('should provide line index to callback', () => {
    const content = `line1
line2
line3`
    const buffer = new TextEncoder().encode(content)
    const lineIndices: number[] = []

    parseLineByLine(buffer, (line, index) => {
      lineIndices.push(index)
      return true
    })

    expect(lineIndices).toEqual([0, 1, 2])
  })

  it('should handle empty buffer', () => {
    const buffer = new TextEncoder().encode('')
    const lines: string[] = []

    parseLineByLine(buffer, line => {
      lines.push(line)
      return true
    })

    expect(lines).toEqual([])
  })

  it('should handle buffer with only whitespace', () => {
    const content = `

	`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(buffer, line => {
      lines.push(line)
      return true
    })

    expect(lines).toEqual([])
  })

  it('should handle single line without newline', () => {
    const content = `single line`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(buffer, line => {
      lines.push(line)
      return true
    })

    expect(lines).toEqual(['single line'])
  })

  // the label used to be cleared only on the happy path, so a throwing callback
  // left the parse's last percentage on screen under whatever error surfaced
  it('clears the status label when a line callback throws', () => {
    const seen: unknown[] = []
    expect(() => {
      parseLineByLine(
        new TextEncoder().encode('a\nb\n'),
        () => {
          throw new Error('nope')
        },
        s => seen.push(s),
      )
    }).toThrow('nope')
    expect(seen.at(-1)).toBe('')
  })
})

describe('groupLinesByRef', () => {
  const group = (content: string) =>
    groupLinesByRef(new TextEncoder().encode(content))

  it('splits header lines from feature lines and stops at FASTA', () => {
    const { headerLines, linesByRef } = group(
      '##gff-version 3\nctgA\tsrc\tgene\nctgB\tsrc\tgene\n>ctgA\nACGT\n',
    )
    expect(headerLines).toEqual(['##gff-version 3'])
    expect(Object.keys(linesByRef)).toEqual(['ctgA', 'ctgB'])
  })

  // the refName is column 1, so a line with no tab has no coordinates either;
  // keying it by its own text published it through getRefNames as a phantom
  // refName (previously the line minus its last character)
  it('skips a line with no tab rather than minting a refName from it', () => {
    const { linesByRef } = group('ctgA\tsrc\tgene\ngarbage\n')
    expect(Object.keys(linesByRef)).toEqual(['ctgA'])
  })
})

describe('makeFeatureIntervalTreeMap', () => {
  const parse = (lines: string[]) =>
    lines.map(line => {
      const [start, end] = line.split('\t').map(Number)
      return { start: start!, end: end! }
    })

  it('keys factories by refName and searches by interval', () => {
    const map = makeFeatureIntervalTreeMap(
      { ctgA: ['0\t10', '20\t30'], ctgB: ['5\t15'] },
      parse,
      'Parsing',
    )

    expect(Object.keys(map)).toEqual(['ctgA', 'ctgB'])
    expect(map.ctgA!().search([5, 25])).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ])
    expect(map.ctgB!().search([0, 1])).toEqual([])
  })

  it('parses lazily once per ref and emits the status message', () => {
    const spy = jest.fn(parse)
    const statusCallback = jest.fn()
    const map = makeFeatureIntervalTreeMap(
      { ctgA: ['0\t10'] },
      spy,
      'Parsing data',
    )

    expect(spy).not.toHaveBeenCalled()

    map.ctgA!(statusCallback)
    map.ctgA!(statusCallback)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(statusCallback).toHaveBeenCalledWith('Parsing data')
    expect(statusCallback).toHaveBeenCalledTimes(1)
  })
})
