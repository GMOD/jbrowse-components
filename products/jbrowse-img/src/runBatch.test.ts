import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { defaultJobs, parseShard, runBatch } from './runBatch.ts'

import type { ProgressReporter } from './progress.ts'

// renderRegion is mocked, not exercised: it imports the plugin renderToSvg
// chain, whose pure-ESM deps Jest's CJS transform can't load — the same reason
// breakpointInit.ts and comparativeInit.ts are separate modules. What this file
// is about is the loop around it, which is where the batch's own behavior lives.
// `mock`-prefixed so jest allows the factory to close over them.
const mockRenderRegion = jest.fn()
const mockResolveConfigObject = jest.fn()
jest.mock('./renderRegion.ts', () => ({
  renderRegionReport: (...args: unknown[]) =>
    mockRenderRegion(...args) as unknown,
}))
// jsdom globals and mobx's static-rendering switch, which a mocked renderer has
// no use for and a jest worker should not have set under it
jest.mock('./setupEnv.ts', () => ({ setupEnv: () => {} }))
jest.mock('./resolveHub.ts', () => ({
  resolveConfigObject: (...args: unknown[]) =>
    mockResolveConfigObject(...args) as unknown,
}))

const BEDPE = [
  'chr1\t1000\t1001\tchr5\t2000\t2001\tSV_1',
  'chr2\t3000\t3001\tchr7\t4000\t4001\tSV_2',
].join('\n')

function steps() {
  const seen: { label: string; error?: string }[] = []
  const progress: ProgressReporter = {
    step: (label, error) => seen.push({ label, ...(error ? { error } : {}) }),
    finish: () => {},
  }
  return { seen, progress }
}

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-batch-'))
  mockRenderRegion.mockReset()
  mockRenderRegion.mockResolvedValue({ svg: '<svg/>' })
  mockResolveConfigObject.mockReset()
  mockResolveConfigObject.mockResolvedValue(undefined)
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function opts(extra: Record<string, unknown> = {}) {
  const bedpe = path.join(dir, 'j.bedpe')
  fs.writeFileSync(bedpe, BEDPE)
  return {
    bedpe,
    outDir: path.join(dir, 'out'),
    format: 'svg' as const,
    ...extra,
  }
}

describe('runBatch', () => {
  it('renders one image per row, named for its junction', async () => {
    const { done } = await runBatch(opts({ progress: steps().progress }))
    expect(done).toBe(2)
    expect(fs.readdirSync(path.join(dir, 'out')).sort()).toEqual([
      '1_chr1_1000-chr5_2000_SV_1.svg',
      '2_chr2_3000-chr7_4000_SV_2.svg',
    ])
  })

  it('refuses --spec, which would render the same image for every row', async () => {
    // The failure it replaces was silent: N byte-identical images, each under a
    // filename naming a different junction, and a `wrote N/N` to finish.
    await expect(runBatch(opts({ spec: 'spec.json' }))).rejects.toThrow(
      /one view per junction/,
    )
    await expect(runBatch(opts({ session: 's.json' }))).rejects.toThrow(
      /--session/,
    )
  })

  it('resolves a fetched config once for the whole run, and copies it per record', async () => {
    // Per record it was one network round trip for the same file — for a --hub
    // that is also one chromAlias fetch from UCSC per junction. readData mutates
    // what it is handed, so each record has to get its own copy.
    const config = { assemblies: [], tracks: [] }
    mockResolveConfigObject.mockResolvedValue(config)
    await runBatch(opts({ hub: 'hg38', progress: steps().progress }))
    expect(mockResolveConfigObject).toHaveBeenCalledTimes(1)
    const handed = mockRenderRegion.mock.calls.map(c => c[1] as unknown)
    expect(handed).toHaveLength(2)
    expect(handed[0]).toEqual(config)
    expect(handed[0]).not.toBe(config)
    expect(handed[0]).not.toBe(handed[1])
  })

  it('keeps going after a failed row and reports it as a failure, not a step', async () => {
    mockRenderRegion
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ svg: '<svg/>' })
    const { seen, progress } = steps()
    const { done, failures } = await runBatch(opts({ progress }))
    expect(done).toBe(1)
    expect(failures).toHaveLength(1)
    expect(seen[0]!.error).toMatch(/FAILED .*: boom/)
    expect(seen[1]!.error).toBeUndefined()
  })

  it('skips a record whose image is already there under --resume', async () => {
    await runBatch(opts({ progress: steps().progress }))
    mockRenderRegion.mockClear()
    const { done } = await runBatch(
      opts({ resume: true, progress: steps().progress }),
    )
    expect(mockRenderRegion).not.toHaveBeenCalled()
    expect(done).toBe(0)
  })

  it('renders nothing under --dryRun', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await runBatch(opts({ dryRun: true }))
      expect(mockRenderRegion).not.toHaveBeenCalled()
      expect(fs.existsSync(path.join(dir, 'out'))).toBe(false)
      expect(log).toHaveBeenCalledWith(
        '1_chr1_1000-chr5_2000_SV_1.svg\tchr1:501-1501\tchr5:1501-2501',
      )
    } finally {
      log.mockRestore()
    }
  })

  it('writes a manifest naming each row and how it ended', async () => {
    mockRenderRegion.mockRejectedValueOnce(new Error('boom'))
    await runBatch(opts({ manifest: true, progress: steps().progress }))
    const rows = fs
      .readFileSync(path.join(dir, 'out', 'manifest.tsv'), 'utf8')
      .trim()
      .split('\n')
    expect(rows[0]).toBe(
      'file\tlocs\tname\tline\tevent\tlinks\talt\tspec\tstatus',
    )
    expect(rows[1]).toBe(
      '1_chr1_1000-chr5_2000_SV_1.svg\tchr1:501-1501 chr5:1501-2501\tSV_1\t1\t\t\t\t\tfailed',
    )
    expect(rows[2]).toMatch(/\tok$/)
  })

  it('renders a record that fits one panel as a linear view, with one locus in the manifest', async () => {
    const vcf = path.join(dir, 'calls.vcf')
    fs.writeFileSync(
      vcf,
      [
        '##fileformat=VCFv4.2',
        '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
        'chr1\t5000\tins1\tN\t<INS>\t.\tPASS\tSVTYPE=INS',
        'chr1\t9000\tdel1\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL;END=9172',
        'chr1\t20000\ttra1\tN\tN[chr5:700[\t.\tPASS\tSVTYPE=BND',
        'chr1\t30000\tdel2\tN\t<DEL>\t.\tPASS\tSVTYPE=DEL;END=63588',
      ].join('\n'),
    )
    mockRenderRegion.mockResolvedValue({
      svg: '<svg/>',
      spec: { type: 'LinearGenomeView', loc: 'chr1:1-2' },
    })
    await runBatch({
      vcf,
      outDir: path.join(dir, 'out'),
      format: 'svg',
      flank: 600,
      manifest: true,
      argv: [['loc', ['chr9:1-100']]],
      progress: steps().progress,
    })
    const calls = mockRenderRegion.mock.calls.map(
      c =>
        c[0] as {
          mode: string
          loc?: string
          joined?: boolean
          sortAt?: { pos: number }
          highlight?: object
          keepAdapters?: boolean
          argv: [string, string[]][]
        },
    )
    // Ends on one contig are one row of a linear view, joined; only ends on two
    // contigs stack as a breakpoint view's panels.
    expect(calls.map(c => [c.mode, c.loc, c.joined])).toEqual([
      ['linear', 'chr1:4400-5600', false],
      ['linear', 'chr1:8400-9772', false],
      ['breakpoint', undefined, undefined],
      ['linear', 'chr1:29400-30600 chr1:62988-64188', true],
    ])
    // every record's adapters stay open for the next
    expect(calls.map(c => c.keepAdapters)).toEqual([true, true, true, true])
    // a deletion of two windows is still counted at its first deleted base;
    // the band over a call's bases is for the one window that holds them all
    expect(calls[3]!.sortAt?.pos).toBe(30000)
    expect(calls[3]!.highlight).toBeUndefined()
    expect(calls[1]!.highlight).toEqual({
      refName: 'chr1',
      start: 9000,
      end: 9172,
    })
    expect(calls[0]!.argv).toEqual([])
    expect(calls[2]!.argv).toEqual([
      ['loc', ['chr1:19400-20600']],
      ['loc', ['chr5:100-1300']],
    ])
    const rows = fs
      .readFileSync(path.join(dir, 'out', 'manifest.tsv'), 'utf8')
      .trim()
      .split('\n')
    expect(rows[1]).toBe(
      '1_chr1_4999_ins1.svg\tchr1:4400-5600\tins1\t3\t\t\t\t{"type":"LinearGenomeView","loc":"chr1:1-2"}\tok',
    )
  })

  it('loads every panel whatever its index estimates, unless the track says force:false', async () => {
    // a gated normal beside a drawn tumor reads as a locus with no support
    await runBatch(
      opts({
        showTracks: [
          ['track', ['tumor_reads', 'height:240']],
          ['track', ['normal_reads', 'force:false']],
        ],
        trackList: [['bam', ['reads.bam']]],
        progress: steps().progress,
      }),
    )
    const handed = mockRenderRegion.mock.calls[0]![0] as {
      showTracks: [string, string[]][]
      trackList: [string, string[]][]
    }
    expect(handed.showTracks).toEqual([
      ['track', ['tumor_reads', 'force:true', 'height:240']],
      ['track', ['normal_reads', 'force:true', 'force:false']],
    ])
    expect(handed.trackList).toEqual([['bam', ['reads.bam', 'force:true']]])
  })

  function manifestRows() {
    return fs
      .readFileSync(path.join(dir, 'out', 'manifest.tsv'), 'utf8')
      .trim()
      .split('\n')
      .map(row => row.split('\t'))
  }

  it('reports the reads joining an image’s panels, per track, and keeps them across --resume', async () => {
    mockRenderRegion
      .mockResolvedValueOnce({ svg: '<svg/>', links: [29, 0] })
      .mockResolvedValueOnce({ svg: '<svg/>', links: [] })
    await runBatch(opts({ manifest: true, progress: steps().progress }))
    const linksAt = manifestRows()[0]!.indexOf('links')
    expect(manifestRows().map(r => r[linksAt])).toEqual(['links', '29,0', ''])

    // the second run renders nothing, so the first run's counts are all there is
    await runBatch(
      opts({ manifest: true, resume: true, progress: steps().progress }),
    )
    expect(manifestRows().map(r => [r[linksAt], r.at(-1)])).toEqual([
      ['links', 'status'],
      ['29,0', 'exists'],
      ['', 'exists'],
    ])
  })

  it('sorts and marks a small variant’s panel, and reports the reads with its ALT', async () => {
    const vcf = path.join(dir, 'snvs.vcf')
    fs.writeFileSync(
      vcf,
      [
        '##fileformat=VCFv4.2',
        '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
        'chr1\t5000\t.\tACGT\tA\t.\tPASS\tDP=30',
      ].join('\n'),
    )
    mockRenderRegion.mockResolvedValueOnce({
      svg: '<svg/>',
      alt: ['12/30', '0/28'],
    })
    await runBatch({
      vcf,
      outDir: path.join(dir, 'out'),
      format: 'svg',
      manifest: true,
      progress: steps().progress,
    })
    expect(mockRenderRegion.mock.calls[0]![0]).toMatchObject({
      mode: 'linear',
      loc: 'chr1:4950-5053',
      sortAt: { type: 'basePair', pos: 5000 },
      // a read with this deletion has a gap at the column, and is what is counted
      sortAllele: { base: '*' },
      highlight: { refName: 'chr1', start: 5000, end: 5003 },
    })
    const rows = manifestRows()
    expect(rows[1]![rows[0]!.indexOf('alt')]).toBe('12/30,0/28')
  })

  function eventVcf() {
    const vcf = path.join(dir, 'events.vcf')
    fs.writeFileSync(
      vcf,
      [
        '##fileformat=VCFv4.4',
        '##contig=<ID=chr3>',
        '##contig=<ID=chr10>',
        '##contig=<ID=chr12>',
        '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
        // three junctions over three loci: a closed chr3-chr10-chr12 triangle
        'chr3\t25000\ta\tN\tN[chr10:58000[\t.\tPASS\tSVTYPE=BND;EVENT=der3',
        'chr10\t58200\tb\tN\tN[chr12:72000[\t.\tPASS\tSVTYPE=BND;EVENT=der3',
        'chr12\t72200\tc\tN\tN[chr3:25400[\t.\tPASS\tSVTYPE=BND;EVENT=der3',
        // GRIDSS files one breakpoint's two mates under an EVENT of their own
        'chr3\t90000\td\tN\tN[chr10:1000[\t.\tPASS\tSVTYPE=BND;EVENT=bp7',
        'chr10\t1000\te\tN\t]chr3:90000]N\t.\tPASS\tSVTYPE=BND;EVENT=bp7',
      ].join('\n'),
    )
    return vcf
  }

  it('draws an event that visits more than two loci once more, every locus in one image', async () => {
    await runBatch({
      vcf: eventVcf(),
      outDir: path.join(dir, 'out'),
      format: 'svg',
      flank: 600,
      manifest: true,
      progress: steps().progress,
    })
    const last = mockRenderRegion.mock.calls.at(-1)![0] as {
      mode: string
      argv: [string, string[]][]
    }
    expect(mockRenderRegion).toHaveBeenCalledTimes(5)
    expect(last.mode).toBe('breakpoint')
    expect(last.argv).toEqual([
      ['loc', ['chr3:24400-26000']],
      ['loc', ['chr10:57400-58800']],
      ['loc', ['chr12:71400-72800']],
    ])
    const rows = fs
      .readFileSync(path.join(dir, 'out', 'manifest.tsv'), 'utf8')
      .trim()
      .split('\n')
    expect(rows.at(-1)).toBe(
      'event_1_der3.svg\tchr3:24400-26000 chr10:57400-58800 chr12:71400-72800\tder3\t\tder3\t\t\t\tok',
    )
    expect(rows.filter(r => r.includes('bp7'))).toHaveLength(1)
  })

  it('draws an event on one contig as rows of a linear view, four windows a row at most', async () => {
    const vcf = path.join(dir, 'one-contig.vcf')
    fs.writeFileSync(
      vcf,
      [
        '##fileformat=VCFv4.2',
        '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
        'chr3\t10000\ta\tN\tN[chr3:30000[\t.\tPASS\tSVTYPE=BND;EVENT=c1',
        'chr3\t50000\tb\tN\tN[chr3:70000[\t.\tPASS\tSVTYPE=BND;EVENT=c1',
        'chr3\t90000\tc\tN\tN[chr3:20000[\t.\tPASS\tSVTYPE=BND;EVENT=c1',
      ].join('\n'),
    )
    await runBatch({
      vcf,
      outDir: path.join(dir, 'out'),
      format: 'svg',
      flank: 600,
      progress: steps().progress,
    })
    const last = mockRenderRegion.mock.calls.at(-1)![0] as {
      mode: string
      argv: [string, string[]][]
    }
    expect(last.mode).toBe('breakpoint')
    expect(last.argv).toEqual([
      [
        'loc',
        ['chr3:9400-10600 chr3:19400-20600 chr3:29400-30600 chr3:49400-50600'],
      ],
      ['loc', ['chr3:69400-70600 chr3:89400-90600']],
    ])
  })

  it('names a --limit run’s images as the whole run will, so --resume finds them', async () => {
    // ten records, so the whole run pads its index to two digits
    const vcf = path.join(dir, 'ten.vcf')
    fs.writeFileSync(
      vcf,
      [
        '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
        ...Array.from(
          { length: 10 },
          (_, i) =>
            `chr1\t${(i + 1) * 100000}\t.\tN\t<INS>\t.\tPASS\tSVTYPE=INS`,
        ),
      ].join('\n'),
    )
    const outDir = path.join(dir, 'out')
    const base = { vcf, outDir, format: 'svg' as const }
    await runBatch({ ...base, limit: 2, progress: steps().progress })
    expect(fs.readdirSync(outDir).sort()).toEqual([
      '01_chr1_99999.svg',
      '02_chr1_199999.svg',
    ])
    mockRenderRegion.mockClear()
    await runBatch({ ...base, resume: true, progress: steps().progress })
    expect(mockRenderRegion).toHaveBeenCalledTimes(8)
  })

  function tenInsertions() {
    const vcf = path.join(dir, 'ten.vcf')
    fs.writeFileSync(
      vcf,
      [
        '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
        ...Array.from(
          { length: 10 },
          (_, i) =>
            `chr1\t${(i + 1) * 100000}\tins${i}\tN\t<INS>\t.\tPASS\tSVTYPE=INS`,
        ),
      ].join('\n'),
    )
    return vcf
  }

  it('renders only its slice as a worker, and reports each row as a line of JSON', async () => {
    const write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      await runBatch({
        vcf: tenInsertions(),
        outDir: path.join(dir, 'out'),
        format: 'svg',
        manifest: true,
        shard: { index: 1, of: 4 },
      })
      const lines = write.mock.calls.map(
        c => JSON.parse(String(c[0])) as { file: string; status: string },
      )
      expect(lines.map(l => l.file)).toEqual([
        '02_chr1_199999_ins1.svg',
        '06_chr1_599999_ins5.svg',
        '10_chr1_999999_ins9.svg',
      ])
      expect(lines.every(l => l.status === 'ok')).toBe(true)
      // the run that started it writes the one manifest
      expect(fs.existsSync(path.join(dir, 'out', 'manifest.tsv'))).toBe(false)
    } finally {
      write.mockRestore()
    }
  })

  // stands in for the CLI: reports its slice of ten rows, and as worker 1 of 2
  // dies after its first
  function fakeWorker() {
    const script = path.join(dir, 'worker.mjs')
    fs.writeFileSync(
      script,
      `const [index, of] = process.argv.at(-1).split('/').map(Number)
const names = Array.from({ length: 10 }, (_, i) =>
  \`\${String(i + 1).padStart(2, '0')}_chr1_\${(i + 1) * 100000 - 1}_ins\${i}.svg\`)
let n = 0
for (const [i, file] of names.entries()) {
  if (i % of === index) {
    if (index === 1 && n++ === 1) {
      process.exit(3)
    }
    console.log(JSON.stringify({ file, status: 'ok', links: \`\${i}\` }))
  }
}
`,
    )
    return { command: process.execPath, args: [script] }
  }

  it('renders in worker processes and writes their rows as one manifest, in callset order', async () => {
    const { seen, progress } = steps()
    const { done, failures } = await runBatch({
      vcf: tenInsertions(),
      outDir: path.join(dir, 'out'),
      format: 'svg',
      manifest: true,
      jobs: 2,
      respawn: fakeWorker(),
      progress,
    })
    expect(mockRenderRegion).not.toHaveBeenCalled()
    expect(seen).toHaveLength(10)
    // worker 0 drew rows 1,3,5,7,9; worker 1 drew row 2 and died
    expect(done).toBe(6)
    expect(failures.map(f => f.name)).toEqual([
      '04_chr1_399999_ins3.svg',
      '06_chr1_599999_ins5.svg',
      '08_chr1_799999_ins7.svg',
      '10_chr1_999999_ins9.svg',
    ])
    expect(String(failures[0]!.error)).toMatch(/worker exited with code 3/)
    const rows = manifestRows()
    expect(rows.slice(1).map(r => r[0])).toEqual(
      Array.from({ length: 10 }, (_, i) =>
        expect.stringMatching(
          new RegExp(`^${String(i + 1).padStart(2, '0')}_`),
        ),
      ),
    )
    const linksAt = rows[0]!.indexOf('links')
    expect(rows.slice(1, 4).map(r => [r[linksAt], r.at(-1)])).toEqual([
      ['0', 'ok'],
      ['1', 'ok'],
      ['2', 'ok'],
    ])
  })

  it('renders a callset too small to be worth a second process in this one', async () => {
    await runBatch(
      opts({ jobs: 8, respawn: fakeWorker(), progress: steps().progress }),
    )
    expect(mockRenderRegion).toHaveBeenCalledTimes(2)
  })

  it('reads a worker’s slice off its command line', () => {
    expect(parseShard('2/8')).toEqual({ index: 2, of: 8 })
    expect([parseShard('8/8'), parseShard('x'), parseShard()]).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(defaultJobs()).toBeGreaterThanOrEqual(1)
    expect(defaultJobs()).toBeLessThanOrEqual(4)
  })

  it('blames the flag, not the file, when --limit selects nothing', async () => {
    await expect(runBatch(opts({ limit: 0 }))).rejects.toThrow(
      /--limit 0 selected none of the 2 records/,
    )
  })
})
