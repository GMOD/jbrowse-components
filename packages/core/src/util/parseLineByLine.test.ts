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

    parseLineByLine(
      buffer,
      line => {
        lines.push(line)
        return true
      },
      undefined,
    )

    expect(lines).toEqual(['line1', 'line2', 'line3'])
  })

  it('should stop parsing when callback returns false', () => {
    const content = `line1
line2
line3
line4`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(
      buffer,
      line => {
        lines.push(line)
        if (line === 'line2') {
          return false
        }
        return true
      },
      undefined,
    )

    expect(lines).toEqual(['line1', 'line2'])
  })

  it('should handle empty lines', () => {
    const content = `line1

line3`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(
      buffer,
      line => {
        lines.push(line)
        return true
      },
      undefined,
    )

    expect(lines).toEqual(['line1', 'line3'])
  })

  it('should handle file without trailing newline', () => {
    const content = `line1
line2`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(
      buffer,
      line => {
        lines.push(line)
        return true
      },
      undefined,
    )

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

    parseLineByLine(
      buffer,
      (line, index) => {
        lineIndices.push(index)
        return true
      },
      undefined,
    )

    expect(lineIndices).toEqual([0, 1, 2])
  })

  it('should handle empty buffer', () => {
    const buffer = new TextEncoder().encode('')
    const lines: string[] = []

    parseLineByLine(
      buffer,
      line => {
        lines.push(line)
        return true
      },
      undefined,
    )

    expect(lines).toEqual([])
  })

  it('should handle buffer with only whitespace', () => {
    const content = `

	`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(
      buffer,
      line => {
        lines.push(line)
        return true
      },
      undefined,
    )

    expect(lines).toEqual([])
  })

  it('should handle single line without newline', () => {
    const content = `single line`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []

    parseLineByLine(
      buffer,
      line => {
        lines.push(line)
        return true
      },
      undefined,
    )

    expect(lines).toEqual(['single line'])
  })

  // The decode is chunked (64KB windows extended to the next newline), so
  // everything below crosses at least one chunk boundary — the cases where a
  // naive window would split a line, a character, or a CRLF pair. Every test
  // above this point fits in a single chunk and so exercises none of it.
  describe('across decode chunk boundaries', () => {
    const collect = (content: string) => {
      const lines: string[] = []
      parseLineByLine(
        new TextEncoder().encode(content),
        line => {
          lines.push(line)
          return true
        },
        undefined,
      )
      return lines
    }

    it('reads every line of a buffer spanning many chunks', () => {
      const expected = Array.from({ length: 20000 }, (_, i) => `line${i}`)
      expect(collect(expected.join('\n'))).toEqual(expected)
    })

    // a line longer than the window has no newline to break on, so the chunk
    // has to grow past its nominal size rather than cut the line in half
    it('keeps a line longer than the chunk window intact', () => {
      const long = 'x'.repeat(200 * 1024)
      expect(collect(`a\n${long}\nb`)).toEqual(['a', long, 'b'])
    })

    // decoding chunks independently is only safe because a chunk never ends
    // mid-character; if it did, the split character would decode to U+FFFD
    it('does not corrupt multi-byte characters at a boundary', () => {
      // pad so the 64KB mark lands in the middle of the run of 3-byte chars
      const pad = `${'a'.repeat(65530)}\n`
      const lines = collect(`${pad}あいうえお\ntail`)
      expect(lines.at(-2)).toBe('あいうえお')
      expect(lines.at(-1)).toBe('tail')
      expect(lines.join('')).not.toContain('�')
    })

    it('handles CRLF line endings across chunks', () => {
      const expected = Array.from({ length: 20000 }, (_, i) => `line${i}`)
      expect(collect(expected.join('\r\n'))).toEqual(expected)
    })

    it('stops on a false return in a later chunk', () => {
      const content = Array.from({ length: 20000 }, (_, i) => `line${i}`).join(
        '\n',
      )
      const lines: string[] = []
      parseLineByLine(
        new TextEncoder().encode(content),
        line => {
          lines.push(line)
          return line !== 'line19000'
        },
        undefined,
      )
      expect(lines.at(-1)).toBe('line19000')
      expect(lines).toHaveLength(19001)
    })

    // blank lines consume a line index even though they never reach the
    // callback, and the counter has to survive a chunk boundary
    it('keeps line indices continuous across chunks', () => {
      const content = `${'y\n'.repeat(50000)}last`
      const seen: number[] = []
      parseLineByLine(
        new TextEncoder().encode(content),
        (_line, index) => {
          seen.push(index)
          return true
        },
        undefined,
      )
      expect(seen).toHaveLength(50001)
      expect(seen.at(-1)).toBe(50000)
      expect(seen).toEqual(seen.map((_, i) => i))
    })
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
