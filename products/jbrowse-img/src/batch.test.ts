import {
  eventOutputName,
  eventRecords,
  outputName,
  parseBedpe,
  recordArgv,
  recordLocs,
} from './batch.ts'

const ROW = {
  loci: [
    { refName: 'chr1', start: 1000, end: 1001 },
    { refName: 'chr5', start: 2000, end: 2001 },
  ],
}

function bedpe(...lines: string[]) {
  return lines.join('\n')
}

describe('parseBedpe', () => {
  it('reads the six coordinate columns and the optional name', () => {
    const { records } = parseBedpe(
      bedpe('chr1\t1000\t1001\tchr5\t2000\t2001\tSV_20\t.\t+\t-'),
    )
    expect(records).toEqual([{ ...ROW, line: 1, name: 'SV_20' }])
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

  it('keeps a single-breakend row as the one locus it names', () => {
    // BEDPE writes an unknown mate as `.`, -1, -1
    const { records, skipped } = parseBedpe(
      bedpe('chr1\t1000\t1001\tchr5\t2000\t2001', 'chr7\t500\t501\t.\t-1\t-1'),
    )
    expect(records[1]).toEqual({
      loci: [{ refName: 'chr7', start: 500, end: 501 }],
      line: 2,
    })
    expect(skipped).toEqual([])
  })

  it('reports a row whose second end is unreadable rather than drawing half of it', () => {
    const { records, skipped } = parseBedpe(
      bedpe(
        'chr1\t1000\t1001\tchr5\t2000\t2001',
        'chr7\t500\t501\tchr9\tabc\tdef',
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

describe('recordLocs / recordArgv', () => {
  it('makes one panel per side, in file order, grown by the flank and 1-based', () => {
    expect(recordLocs(ROW, 100)).toEqual(['chr1:901-1101', 'chr5:1901-2101'])
  })

  it('clamps at the start of a chromosome', () => {
    expect(
      recordLocs({ loci: [{ refName: 'chr1', start: 10, end: 11 }] }, 500),
    ).toEqual(['chr1:1-511'])
  })

  it('draws two ends of one contig whose windows overlap as one panel', () => {
    // a 172 bp deletion at a 600 bp flank: two panels would be the same reads
    // twice, 172 bp apart
    const del = {
      loci: [
        { refName: 'chr1', start: 5000, end: 5001 },
        { refName: 'chr1', start: 5172, end: 5173 },
      ],
    }
    expect(recordLocs(del, 600)).toEqual(['chr1:4401-5773'])
  })

  it('keeps two panels for ends of one contig further apart than the flank reaches', () => {
    const del = {
      loci: [
        { refName: 'chr1', start: 5000, end: 5001 },
        { refName: 'chr1', start: 9000, end: 9001 },
      ],
    }
    expect(recordLocs(del, 600)).toHaveLength(2)
  })

  it('never merges across contigs, whatever the coordinates', () => {
    const tra = {
      loci: [
        { refName: 'chr1', start: 5000, end: 5001 },
        { refName: 'chr2', start: 5000, end: 5001 },
      ],
    }
    expect(recordLocs(tra, 600)).toHaveLength(2)
  })

  it('emits them as separate --loc entries, which is what stacks panels', () => {
    expect(recordArgv(ROW, 100)).toEqual([
      ['loc', ['chr1:901-1101']],
      ['loc', ['chr5:1901-2101']],
    ])
  })
})

describe('eventRecords', () => {
  const at = (refName: string, start: number) => ({
    refName,
    start,
    end: start + 1,
  })

  it('gathers the loci of every record filed under one event, in genome order', () => {
    const events = eventRecords(
      [
        { loci: [at('chr12', 700), at('chr3', 900)], event: 'c1' },
        { loci: [at('chr3', 100), at('chr10', 500)], event: 'c1' },
        { loci: [at('chr1', 5), at('chr2', 5)] },
        { loci: [at('chr7', 1)], event: 'c2' },
      ],
      ['chr3', 'chr10', 'chr12'],
    )
    expect(events).toEqual([
      {
        event: 'c1',
        name: 'c1',
        loci: [
          at('chr3', 100),
          at('chr3', 900),
          at('chr10', 500),
          at('chr12', 700),
        ],
      },
      { event: 'c2', name: 'c2', loci: [at('chr7', 1)] },
    ])
  })

  it('puts a contig the header never named after the ones it did', () => {
    const [event] = eventRecords(
      [{ loci: [at('scaffold_9', 1), at('chr3', 1)], event: 'c1' }],
      ['chr3'],
    )
    expect(event!.loci.map(l => l.refName)).toEqual(['chr3', 'scaffold_9'])
  })

  it('draws ends of one event that share a window as one panel', () => {
    const [event] = eventRecords(
      [
        { loci: [at('chr3', 1000), at('chr10', 5000)], event: 'c1' },
        { loci: [at('chr10', 5200), at('chr3', 1400)], event: 'c1' },
      ],
      ['chr3', 'chr10'],
    )
    expect(recordLocs(event!, 600)).toEqual([
      'chr3:401-2001',
      'chr10:4401-5801',
    ])
  })
})

describe('eventOutputName', () => {
  it('sorts after the numbered records and sanitizes the label', () => {
    expect(
      eventOutputName({ loci: [], name: 'cluster 3/a' }, 2, 15, 'png'),
    ).toBe('event_03_cluster-3-a.png')
  })
})

describe('outputName', () => {
  it('leads with a zero-padded index so the directory sorts in callset order', () => {
    expect(outputName(ROW, 9, 100, 'png')).toBe('010_chr1_1000-chr5_2000.png')
  })

  it('pads to the width of the largest index, not a fixed width', () => {
    expect(outputName(ROW, 0, 5, 'png')).toBe('1_chr1_1000-chr5_2000.png')
  })

  it('names a one-locus record by that locus', () => {
    expect(
      outputName(
        { loci: [{ refName: 'chr7', start: 500, end: 501 }], name: 'ins1' },
        0,
        1,
        'png',
      ),
    ).toBe('1_chr7_500_ins1.png')
  })

  it('carries the name when there is one, sanitized for a filename', () => {
    expect(outputName({ ...ROW, name: 'BCR--ABL1 fusion' }, 0, 1, 'svg')).toBe(
      '1_chr1_1000-chr5_2000_BCR--ABL1-fusion.svg',
    )
  })

  it('sanitizes the refNames too, not only the name column', () => {
    const name = outputName(
      {
        loci: [
          { refName: 'GL000/1', start: 1000, end: 1001 },
          { refName: 'gi|123|ref', start: 2000, end: 2001 },
        ],
      },
      0,
      1,
      'png',
    )
    expect(name).not.toContain('/')
    expect(name).toBe('1_GL000-1_1000-gi-123-ref_2000.png')
  })
})
