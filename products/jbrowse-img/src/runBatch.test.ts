import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { runBatch } from './runBatch.ts'

import type { ProgressReporter } from './progress.ts'

// renderRegion is mocked, not exercised: it imports the plugin renderToSvg
// chain, whose pure-ESM deps Jest's CJS transform can't load — the same reason
// breakpointInit.ts and comparativeInit.ts are separate modules. What this file
// is about is the loop around it, which is where the batch's own behavior lives.
// `mock`-prefixed so jest allows the factory to close over them.
const mockRenderRegion = jest.fn()
const mockResolveConfigObject = jest.fn()
jest.mock('./renderRegion.ts', () => ({
  renderRegion: (...args: unknown[]) => mockRenderRegion(...args) as unknown,
}))
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
  mockRenderRegion.mockResolvedValue('<svg/>')
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
      .mockResolvedValueOnce('<svg/>')
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
    expect(rows[0]).toBe('file\tlocs\tname\tline\tevent\tstatus')
    expect(rows[1]).toBe(
      '1_chr1_1000-chr5_2000_SV_1.svg\tchr1:501-1501 chr5:1501-2501\tSV_1\t1\t\tfailed',
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
      ].join('\n'),
    )
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
      c => c[0] as { mode: string; loc?: string; argv: [string, string[]][] },
    )
    expect(calls.map(c => [c.mode, c.loc])).toEqual([
      ['linear', 'chr1:4400-5600'],
      ['linear', 'chr1:8400-9772'],
      ['breakpoint', undefined],
    ])
    expect(calls[0]!.argv).toEqual([])
    expect(calls[2]!.argv).toEqual([
      ['loc', ['chr1:19400-20600']],
      ['loc', ['chr5:100-1300']],
    ])
    const rows = fs
      .readFileSync(path.join(dir, 'out', 'manifest.tsv'), 'utf8')
      .trim()
      .split('\n')
    expect(rows[1]).toBe('1_chr1_4999_ins1.svg\tchr1:4400-5600\tins1\t3\t\tok')
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
      'event_1_der3.svg\tchr3:24400-26000 chr10:57400-58800 chr12:71400-72800\tder3\t\tder3\tok',
    )
    expect(rows.filter(r => r.includes('bp7'))).toHaveLength(1)
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

  it('blames the flag, not the file, when --limit selects nothing', async () => {
    await expect(runBatch(opts({ limit: 0 }))).rejects.toThrow(
      /--limit 0 selected none of the 2 records/,
    )
  })
})
