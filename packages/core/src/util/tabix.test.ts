import { createStopToken, stopStopToken } from './stopToken.ts'
import { readTabixLines, readTabixLinesRedispatched } from './tabix.ts'

// A stand-in for @gmod/tabix's TabixIndexedFile that records the opts it was
// handed and emits two lines. The point of these tests is the cancellation
// contract at the boundary — that a live AbortSignal reaches the reader and
// tracks the stop token — since a signal that is threaded but never wired is
// indistinguishable from no signal at all until a real download is cancelled.
function fakeSource() {
  const seen: { signal?: AbortSignal }[] = []
  return {
    seen,
    getLines: async (
      _refName: string,
      _start: number | undefined,
      _end: number | undefined,
      opts: {
        lineCallback: (
          line: string,
          offset: number,
          start: number,
          end: number,
        ) => void
        signal?: AbortSignal
      },
    ) => {
      seen.push({ signal: opts.signal })
      opts.lineCallback('ctgA\tsrc\tgene\t1\t100\t.\t+\t.\tID=g1', 0, 0, 100)
      opts.lineCallback('ctgA\tsrc\texon\t1\t50\t.\t+\t.\tID=e1', 42, 0, 50)
      await Promise.resolve()
    },
  }
}

describe('readTabixLines', () => {
  it('captures each line with its offset, bounds and type', async () => {
    const source = fakeSource()
    const lines = await readTabixLines(source, 'ctgA', 0, 100)
    expect(lines).toEqual([
      {
        line: 'ctgA\tsrc\tgene\t1\t100\t.\t+\t.\tID=g1',
        offset: 0,
        start: 0,
        end: 100,
        type: 'gene',
      },
      {
        line: 'ctgA\tsrc\texon\t1\t50\t.\t+\t.\tID=e1',
        offset: 42,
        start: 0,
        end: 50,
        type: 'exon',
      },
    ])
  })

  // A GFF3/GTF line can be truncated by a partial write, and column 3 has no
  // trailing tab when it is the last column. Reading to `indexOf('\t') === -1`
  // as an end offset silently dropped the type's last character, which then fed
  // the redispatch classification.
  it.each([
    ['ctgA\tsrc\tgene', 'gene'],
    ['ctgA\tsrc\t', ''],
    ['ctgA\tsrc', ''],
    ['ctgA', ''],
    ['', ''],
  ])('reads the type from a truncated line (%p)', async (line, type) => {
    const source = {
      getLines: async (
        _refName: string,
        _start: number | undefined,
        _end: number | undefined,
        opts: {
          lineCallback: (l: string, o: number, s: number, e: number) => void
        },
      ) => {
        opts.lineCallback(line, 0, 0, 1)
        await Promise.resolve()
      },
    }
    const lines = await readTabixLines(source, 'ctgA', 0, 100)
    expect(lines[0]!.type).toBe(type)
  })

  // Asserted from inside the read, because withStopTokenSignal releases the
  // signal once the read settles — which is the point of the helper, and would
  // make an after-the-fact check pass for a signal that was never wired. A
  // string token rather than createStopToken() so the abort is observable
  // synchronously: a SharedArrayBuffer token routes through Atomics.waitAsync
  // and lands a turn later.
  it('hands the reader a signal that is live and tracks the token', async () => {
    const stopToken = 'tabix-live-signal'
    let abortedDuringRead: boolean | undefined
    const source = fakeSource()
    const stopMidRead = {
      ...source,
      getLines: async (
        refName: string,
        start: number | undefined,
        end: number | undefined,
        opts: Parameters<typeof source.getLines>[3],
      ) => {
        expect(opts.signal?.aborted).toBe(false)
        stopStopToken(stopToken)
        abortedDuringRead = opts.signal?.aborted
        return source.getLines(refName, start, end, opts)
      },
    }
    await readTabixLines(stopMidRead, 'ctgA', 0, 100, undefined, stopToken)
    expect(abortedDuringRead).toBe(true)
  })

  it('hands the reader an already-aborted signal for a stopped token', async () => {
    const source = fakeSource()
    const stopToken = createStopToken()
    stopStopToken(stopToken)
    await readTabixLines(source, 'ctgA', 0, 100, undefined, stopToken)
    expect(source.seen[0]!.signal?.aborted).toBe(true)
  })

  it('still passes a signal with no stop token, and never aborts it', async () => {
    const source = fakeSource()
    await readTabixLines(source, 'ctgA', 0, 100)
    expect(source.seen[0]!.signal?.aborted).toBe(false)
  })
})

// A source whose lines are fixed per call, so a test can make the first read
// return a feature that overhangs the query and watch what the second read asks
// for. Records the (start, end) of every read.
function overhangingSource(
  lines: { type: string; start: number; end: number }[],
) {
  const reads: [number | undefined, number | undefined][] = []
  return {
    reads,
    getLines: async (
      _refName: string,
      start: number | undefined,
      end: number | undefined,
      opts: {
        lineCallback: (l: string, o: number, s: number, e: number) => void
      },
    ) => {
      reads.push([start, end])
      for (const [i, f] of lines.entries()) {
        opts.lineCallback(
          `ctgA\tsrc\t${f.type}\t1\t2\t.\t+\t.\t`,
          i,
          f.start,
          f.end,
        )
      }
      await Promise.resolve()
    },
  }
}

describe('readTabixLinesRedispatched', () => {
  it('reads once when nothing overhangs the query', async () => {
    const source = overhangingSource([{ type: 'gene', start: 20, end: 80 }])
    const lines = await readTabixLinesRedispatched(
      source,
      { refName: 'ctgA', start: 0, end: 100 },
      new Set(),
    )
    expect(source.reads).toEqual([[0, 100]])
    expect(lines).toHaveLength(1)
  })

  // The flanks, not the union: re-reading [50, 5000] would fetch the query range
  // a second time, which is most of the work of a browsed window done twice and
  // is what halved the download bar — a second phase whose total was the whole
  // region again.
  it('reads only the overhang on each side of the query', async () => {
    const source = overhangingSource([{ type: 'gene', start: 50, end: 5000 }])
    await readTabixLinesRedispatched(
      source,
      { refName: 'ctgA', start: 100, end: 200 },
      new Set(),
    )
    expect(source.reads).toEqual([
      [100, 200],
      [50, 100],
      [200, 5000],
    ])
  })

  it('reads one flank when the feature overhangs one side', async () => {
    const source = overhangingSource([{ type: 'gene', start: 120, end: 5000 }])
    await readTabixLinesRedispatched(
      source,
      { refName: 'ctgA', start: 100, end: 200 },
      new Set(),
    )
    expect(source.reads).toEqual([
      [100, 200],
      [200, 5000],
    ])
  })

  it('expands exactly once, never chasing the flanks', async () => {
    // every read returns the same overhanging line, so a loop would keep going;
    // the contract is the query plus its two flanks at most
    const source = overhangingSource([{ type: 'gene', start: 50, end: 5000 }])
    await readTabixLinesRedispatched(
      source,
      { refName: 'ctgA', start: 100, end: 200 },
      new Set(),
    )
    expect(source.reads).toHaveLength(3)
  })

  // Tabix returns the lines OVERLAPPING a range, so a line straddling a flank
  // boundary comes back from two reads. `offset` is the line's position in the
  // file, which is what makes the collapse exact and the order file order.
  it('returns a line found by two reads once, in file order', async () => {
    const source = overhangingSource([
      { type: 'gene', start: 50, end: 5000 },
      { type: 'mRNA', start: 60, end: 4000 },
    ])
    const lines = await readTabixLinesRedispatched(
      source,
      { refName: 'ctgA', start: 100, end: 200 },
      new Set(),
    )
    expect(lines.map(l => l.offset)).toEqual([0, 1])
    expect(lines.map(l => l.type)).toEqual(['gene', 'mRNA'])
  })

  it('leaves a dontRedispatch type out of the bounds', async () => {
    const source = overhangingSource([
      { type: 'chromosome', start: 0, end: 1_000_000 },
      { type: 'gene', start: 120, end: 180 },
    ])
    const lines = await readTabixLinesRedispatched(
      source,
      { refName: 'ctgA', start: 100, end: 200 },
      new Set(['chromosome']),
    )
    expect(source.reads).toEqual([[100, 200]])
    // the chromosome line is still returned, just not allowed to widen the read
    expect(lines).toHaveLength(2)
  })
})

// readTabixHeaderLines is a delegate to @gmod/tabix's getHeaderLines as of
// 3.5.4, so the commented-header / counted-rows / neither cases are tested
// there, against real files rather than a stub. What reaches this repo is
// covered end-to-end by the adapters that read a header: BedTabixAdapter's
// commented-header and 1-based skip-line-header tests, and PlinkLDTabixAdapter.
