import {
  outputName,
  panelLoc,
  parseBedpe,
  recordArgv,
  recordLocs,
} from './batch.ts'

const ROW = {
  refName1: 'chr1',
  start1: 1000,
  end1: 1001,
  refName2: 'chr5',
  start2: 2000,
  end2: 2001,
}

function bedpe(...lines: string[]) {
  return lines.join('\n')
}

describe('parseBedpe', () => {
  it('reads the six coordinate columns and the optional name', () => {
    const { records } = parseBedpe(
      bedpe('chr1\t1000\t1001\tchr5\t2000\t2001\tSV_20\t.\t+\t-'),
    )
    expect(records).toEqual([{ ...ROW, name: 'SV_20' }])
  })

  it('skips comments, track/browser lines and blanks', () => {
    const { records, skipped } = parseBedpe(
      bedpe(
        '# a comment',
        'track name="calls"',
        'browser position chr1',
        '',
        'chr1\t1000\t1001\tchr5\t2000\t2001',
      ),
    )
    expect(records).toHaveLength(1)
    expect(skipped).toEqual([])
  })

  it('drops a single-breakend row rather than aborting the run', () => {
    // BEDPE writes an unknown mate as -1. A callset always has a few, and the
    // whole point of a batch is that row 400 failing does not cost rows 1-399.
    const { records, skipped } = parseBedpe(
      bedpe(
        'chr1\t1000\t1001\tchr5\t2000\t2001',
        'chr7\t500\t501\t.\t-1\t-1',
        'chr2\t10\t11\tchr3\t20\t21',
      ),
    )
    expect(records).toHaveLength(2)
    expect(skipped).toHaveLength(1)
    expect(skipped[0]).toMatch(/line 2/)
  })

  it('reports a short row instead of reading past the end of it', () => {
    const { records, skipped } = parseBedpe(bedpe('chr1\t1000\t1001'))
    expect(records).toEqual([])
    expect(skipped[0]).toMatch(/needs 6 columns, got 3/)
  })

  it('treats "." as no name', () => {
    const { records } = parseBedpe(
      bedpe('chr1\t1000\t1001\tchr5\t2000\t2001\t.'),
    )
    expect(records[0]!.name).toBeUndefined()
  })
})

describe('panelLoc', () => {
  it('grows the breakend interval by the flank, 1-based out', () => {
    expect(panelLoc('chr1', 1000, 1001, 500)).toBe('chr1:501-1501')
  })

  it('clamps at the start of a chromosome', () => {
    // A breakend at position 10 with a 500bp flank would otherwise ask for a
    // negative coordinate, which no locstring parses.
    expect(panelLoc('chr1', 10, 11, 500)).toBe('chr1:1-511')
  })
})

describe('recordLocs / recordArgv', () => {
  it('makes one panel per side, in file order', () => {
    expect(recordLocs(ROW, 100)).toEqual(['chr1:901-1101', 'chr5:1901-2101'])
  })

  it('emits them as separate --loc entries, which is what stacks panels', () => {
    expect(recordArgv(ROW, 100)).toEqual([
      ['loc', ['chr1:901-1101']],
      ['loc', ['chr5:1901-2101']],
    ])
  })
})

describe('outputName', () => {
  it('leads with a zero-padded index so the directory sorts in callset order', () => {
    expect(outputName(ROW, 9, 100, 'png')).toBe('010_chr1_1000-chr5_2000.png')
  })

  it('pads to the width of the largest index, not a fixed width', () => {
    expect(outputName(ROW, 0, 5, 'png')).toBe('1_chr1_1000-chr5_2000.png')
  })

  it('carries the name when there is one, sanitized for a filename', () => {
    expect(outputName({ ...ROW, name: 'BCR--ABL1 fusion' }, 0, 1, 'svg')).toBe(
      '1_chr1_1000-chr5_2000_BCR--ABL1-fusion.svg',
    )
  })

  it('sanitizes the refNames too, not only the name column', () => {
    // A refName is no safer than a caller's label: a `/` in one builds a path
    // into a directory that does not exist, and the record then fails at write
    // time having already paid for its render.
    const name = outputName(
      { ...ROW, refName1: 'GL000/1', refName2: 'gi|123|ref' },
      0,
      1,
      'png',
    )
    expect(name).not.toContain('/')
    expect(name).toBe('1_GL000-1_1000-gi-123-ref_2000.png')
  })
})
