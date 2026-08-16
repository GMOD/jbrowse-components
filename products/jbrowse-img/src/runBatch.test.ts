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
    expect(rows[0]).toBe('file\tloc1\tloc2\tname\tstatus')
    expect(rows[1]).toMatch(
      /^1_chr1_1000-chr5_2000_SV_1\.svg\t.*\tSV_1\tfailed$/,
    )
    expect(rows[2]).toMatch(/\tok$/)
  })

  it('blames the flag, not the file, when --limit selects nothing', async () => {
    await expect(runBatch(opts({ limit: 0 }))).rejects.toThrow(
      /--limit 0 selected none of the 2 junctions/,
    )
  })
})
