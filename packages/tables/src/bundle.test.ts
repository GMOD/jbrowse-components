import { execFileSync } from 'node:child_process'
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { gzipSync } from 'node:zlib'

import { parse } from 'acorn'

import { MIN_ADAPTER_BYTES, createTablesEngine } from './index.ts'
import {
  ALL_VS_ALL,
  INV_INDELS,
  INV_INDELS_DOTPLOT,
  SYRI,
} from './synteny.fixture.ts'
import {
  BAM,
  BIGBED,
  COVERAGE_BIGWIG,
  CRAM,
  DOG_VCF,
  GFF3,
  METHYLATED,
  SIGNED_BIGWIG,
} from './volvox.fixture.ts'
import { fromWire } from './wire.ts'

// A host with no web globals at all, as R's V8 is: an empty vm context, less
// the `Intl` R's V8 is built without, where the only thing the bundle is
// handed is a synchronous byte reader.
const rangeBytes = new Map<string, number>()
const wholeReads = new Map<string, number>()
const add = (counts: Map<string, number>, url: string, n: number) =>
  counts.set(url, (counts.get(url) ?? 0) + n)

function readRange(url: string, start: number, end: number) {
  const file = fileURLToPath(url)
  const size = statSync(file).size
  const last = end < 0 ? size - 1 : Math.min(end, size - 1)
  const bytes = new Uint8Array(Math.max(0, last - start + 1))
  const fd = openSync(file, 'r')
  readSync(fd, bytes, 0, bytes.length, start)
  closeSync(fd)
  const whole = end < 0 && start === 0
  if (whole) {
    add(wholeReads, url, 1)
  } else {
    add(rangeBytes, url, bytes.length)
  }
  return { status: whole ? 200 : 206, size, bytes }
}

let jbrowse: {
  alignments: (args: string) => Promise<string>
  features: (args: string) => Promise<string>
  wiggle: (args: string) => Promise<string>
  variants: (args: string) => Promise<string>
  alignmentMarkAlpha: (args: string) => Promise<string>
  synteny: (args: string) => Promise<string>
  dotplot: (args: string) => Promise<string>
  contigs: (args: string) => Promise<string>
  multiway: (args: string) => Promise<string>
  regions: (args: string) => Promise<string>
  canonicalNames: (args: string) => Promise<string>
  fileRegions: (args: string) => Promise<string>
  cache: (args: string) => Promise<string>
  clearCache: () => Promise<string>
}
let code: string

// what a host reads off the wire, its nested columns arrays again
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const read = (wire: string) =>
  fromWire(JSON.parse(wire), sandbox.jbrowseBytes as Uint8Array) as any

let sandbox: Record<string, unknown>

beforeAll(() => {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'tables-')), 'b.js')
  execFileSync(
    process.execPath,
    [path.join(__dirname, '../scripts/build-bundle.mjs'), out],
    { env: { ...process.env, MINIFY: '0' } },
  )
  code = readFileSync(out, 'utf8')
  sandbox = { jbrowseHost: { readRange } }
  vm.createContext(sandbox)
  vm.runInContext('delete globalThis.Intl', sandbox)
  vm.runInContext(code, sandbox)
  jbrowse = sandbox.jbrowse as typeof jbrowse
}, 120_000)

// A host reads the bundle as text, so it is printable ASCII plus newline and
// tab, and ES2020, which every V8 an R user has since 2020 parses.
test('the bundle is printable ASCII and ES2020', () => {
  expect(code).toMatch(/^[\n\t\x20-\x7E]*$/)
  expect(() => parse(code, { ecmaVersion: 2020 })).not.toThrow()
})

test.each([
  ['BAM', BAM],
  ['CRAM', CRAM],
  [
    'modBAM',
    { ...METHYLATED, display: { baseColor: { field: 'modifications' } } },
  ],
])(
  'the bundle answers a %s as the engine does, in a bare host',
  async (_, args) => {
    const bare = read(await jbrowse.alignments(JSON.stringify(args)))
    const direct = await createTablesEngine().alignments(args)
    expect(bare.reads.name).toEqual(direct.reads.name)
    expect(bare.reads.row).toEqual(direct.reads.row)
    expect(bare.reads.start).toEqual(Array.from(direct.reads.start))
    expect(bare.mismatches.position).toEqual(
      Array.from(direct.mismatches.position),
    )
    expect(bare.coverage.depth).toEqual(Array.from(direct.coverage.depth))
    expect(bare.modifications.position).toEqual(
      Array.from(direct.modifications.position),
    )
  },
)

test.each([
  ['GFF3', GFF3],
  ['BigBed', BIGBED],
])(
  'the bundle answers a %s feature track as the engine does, in a bare host',
  async (_, args) => {
    const bare = read(await jbrowse.features(JSON.stringify(args)))
    const direct = await createTablesEngine().features(args)
    expect(bare.features.id.length).toBeGreaterThan(0)
    // jest stubs the adapter's id prefix, so ids differ by it alone
    const { id: _bareId, ...bareFeatures } = bare.features
    const { id: _directId, ...directFeatures } = direct.features
    expect(bareFeatures).toEqual(directFeatures)
    expect(bare.rects).toEqual(direct.rects)
    expect(bare.labels).toEqual(direct.labels)
  },
)

test.each([
  ['signed', SIGNED_BIGWIG],
  ['zoomed-out min-max', { ...COVERAGE_BIGWIG, bpPerPx: 1000 }],
  ['density', { ...SIGNED_BIGWIG, display: { mark: 'span' } }],
])(
  'the bundle answers a %s BigWig as the engine does, in a bare host',
  async (_, args) => {
    const bare = read(await jbrowse.wiggle(JSON.stringify(args)))
    const direct = await createTablesEngine().wiggle(args)
    expect(bare.bins.score.length).toBeGreaterThan(0)
    expect(bare.bins).toEqual(direct.bins)
    expect(bare.marks).toEqual(direct.marks)
    expect(bare.domain).toEqual(direct.domain)
  },
)

test.each([
  ['allele', DOG_VCF],
  ['haplotype', { ...DOG_VCF, display: { unit: 'haplotype' } }],
])(
  'the bundle answers a multi-sample VCF by %s as the engine does, in a bare host',
  async (_, args) => {
    const bare = read(await jbrowse.variants(JSON.stringify(args)))
    const direct = await createTablesEngine().variants(args)
    expect(bare.cells.variant.length).toBeGreaterThan(0)
    const { id: _bareId, ...bareVariants } = bare.variants
    const { id: _directId, ...directVariants } = direct.variants
    expect(bareVariants).toEqual(directVariants)
    expect(bare.cells).toEqual(direct.cells)
    expect(bare.legend).toEqual(direct.legend)
    expect(bare.info).toEqual(direct.info)
  },
)

test('numbers cross as bytes, repeated text as codes, and a nested column as its rows’ lengths and values', async () => {
  const wire = JSON.parse(await jbrowse.variants(JSON.stringify(DOG_VCF)))
  const bytes = sandbox.jbrowseBytes as Uint8Array
  const direct = await createTablesEngine().variants(DOG_VCF)
  const kind = (column: object) => Object.keys(column)[0]
  expect(kind(wire.variants.start)).toBe('$i32')
  expect(kind(wire.info.BaseQRankSum)).toBe('$f64')
  expect(kind(wire.info.POSITIVE_TRAIN_SITE)).toBe('$lgl')
  expect(kind(wire.cells.genotype)).toBe('$dict')
  expect(Array.isArray(wire.variants.id)).toBe(true)
  expect(fromWire(wire.variants.start, bytes)).toEqual(direct.variants.start)
  // a missing value crosses as NA and reads back null
  expect(direct.info.BaseQRankSum).toContain(null)
  expect(fromWire(wire.info.BaseQRankSum, bytes)).toEqual(
    direct.info.BaseQRankSum,
  )
  expect(fromWire(wire.cells.genotype, bytes)).toEqual(direct.cells.genotype)
  const ac = direct.info.AC as (number[] | null)[]
  expect(ac.some(v => v?.length === 2)).toBe(true)
  expect(kind(wire.info.AC)).toBe('$list')
  expect(fromWire(wire.info.AC.$list.lengths, bytes)).toEqual(
    ac.map(v => v?.length ?? -1),
  )
  expect(fromWire(wire.info.AC, bytes)).toEqual(ac)
  // only text and the tables' shape are left to parse
  expect(JSON.stringify(wire).length).toBeLessThan(bytes.length)
})

test('the bundle reads a file under its alias through an assembly, in a bare host', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tables-'))
  const aliases = path.join(dir, 'aliases.txt')
  writeFileSync(aliases, 'ctgA\tcontigA\nctgB\tcontigB\n')
  const volvox = (file: string) =>
    pathToFileURL(path.resolve('test_data/volvox', file)).href
  const assembly = {
    name: 'volvox',
    uri: volvox('volvox.fa'),
    refNameAliases: { uri: pathToFileURL(aliases).href },
  }
  const args = {
    adapterConfig: {
      type: 'BamAdapter',
      bamLocation: { uri: volvox('volvox-sorted-altname.bam') },
      index: { location: { uri: volvox('volvox-sorted-altname.bam.bai') } },
    },
    region: BAM.region,
    assembly,
  }
  const bare = read(await jbrowse.alignments(JSON.stringify(args)))
  expect(bare.readAs).toEqual({
    refName: ['contigA'],
    originalRefName: ['ctgA'],
  })
  expect(bare.reads.start).toEqual(
    Array.from((await createTablesEngine().alignments(BAM)).reads.start),
  )
  expect(read(await jbrowse.regions(JSON.stringify({ assembly })))).toEqual({
    refName: ['ctgA', 'ctgB'],
    canonical: ['ctgA', 'ctgB'],
    start: [0, 0],
    end: [50001, 6079],
  })
  expect(
    read(
      await jbrowse.canonicalNames(
        JSON.stringify({ assembly, refNames: ['contigA', 'ctgB'] }),
      ),
    ),
  ).toEqual({ refName: ['contigA', 'ctgB'], canonical: ['ctgA', 'ctgB'] })
})

test('the bundle fades a region’s marks as the engine does, at a host’s px per bp', async () => {
  const engine = createTablesEngine()
  const t = await engine.alignments(BAM)
  const deletion = t.gaps.type.map(type => type === 'deletion')
  const args = {
    pxPerBp: 0.05,
    featureHeight: t.readPitch.featureHeight,
    fadeLowFrequency: true,
    insertions: { length: t.insertions.length, fade: t.insertions.fade },
    deletions: {
      length: t.gaps.start
        .map((start, i) => t.gaps.end[i]! - start)
        .filter((_, i) => deletion[i]),
      fade: t.gaps.fade.filter((_, i) => deletion[i]),
    },
    mismatches: { fade: t.mismatches.fade, quality: t.mismatches.quality },
    clips: { fade: t.clips.fade },
  }
  expect(read(await jbrowse.alignmentMarkAlpha(JSON.stringify(args)))).toEqual(
    engine.alignmentMarkAlpha(args),
  )
})

test('the bundle answers a PAF as the engine does, in a bare host', async () => {
  const bare = read(await jbrowse.synteny(JSON.stringify(INV_INDELS)))
  const direct = await createTablesEngine().synteny(INV_INDELS)
  expect(bare.ribbons.kind.length).toBeGreaterThan(7)
  const { id: _bareId, ...bareAlignments } = bare.alignments
  const { id: _directId, ...directAlignments } = direct.alignments
  expect(bareAlignments).toEqual(directAlignments)
  expect(bare.ribbons).toEqual(direct.ribbons)
  expect(bare.legend).toEqual(direct.legend)

  const bareDots = read(
    await jbrowse.dotplot(JSON.stringify(INV_INDELS_DOTPLOT)),
  )
  const directDots = await createTablesEngine().dotplot(INV_INDELS_DOTPLOT)
  expect(bareDots.segments).toEqual(directDots.segments)

  const args = { adapterConfig: INV_INDELS.adapterConfig }
  expect(read(await jbrowse.contigs(JSON.stringify(args)))).toEqual(
    await createTablesEngine().contigs(args),
  )
})

test('the bundle stacks a multi-genome PAF as the engine does, in a bare host', async () => {
  for (const args of [ALL_VS_ALL, SYRI]) {
    const bare = read(await jbrowse.multiway(JSON.stringify(args)))
    const direct = await createTablesEngine().multiway(args)
    expect(bare.ribbons.kind.length).toBeGreaterThan(2)
    expect(bare.lanes).toEqual(direct.lanes)
    expect(bare.segments).toEqual(direct.segments)
    expect(bare.blocks).toEqual(direct.blocks)
    expect(bare.ribbons).toEqual(direct.ribbons)
    expect(bare.alignments).toEqual(direct.alignments)
    expect(bare.legend).toEqual(direct.legend)
  }
})

interface CacheUse {
  limit: number | null
  decoded: number
  chunks: number
  parsed: number
  adapters: number
}
const cache = async (args = {}) =>
  JSON.parse(await jbrowse.cache(JSON.stringify(args))) as CacheUse

describe('a bare host under a budget', () => {
  let limit: number | null
  beforeAll(async () => {
    ;({ limit } = await cache())
  })
  beforeEach(async () => {
    await jbrowse.clearCache()
    await cache({ limit })
    rangeBytes.clear()
    wholeReads.clear()
  })
  afterAll(async () => {
    await jbrowse.clearCache()
    await cache({ limit })
  })

  test.each([
    ['BAM', BAM],
    ['CRAM', CRAM],
  ])(
    'a %s read through an assembly opens the file once',
    async (_, { adapterConfig, sequenceAdapter, region }) => {
      const assembly = {
        name: 'volvox',
        sequence: { adapter: sequenceAdapter },
      }
      await jbrowse.fileRegions(JSON.stringify({ adapterConfig, assembly }))
      await jbrowse.alignments(
        JSON.stringify({ adapterConfig, region, assembly }),
      )
      expect((await cache()).adapters).toBe(2)
      expect(wholeReads.size).toBeGreaterThan(1)
      expect(new Set(wholeReads.values())).toEqual(new Set([1]))
    },
  )

  test('a BAM read as features through an assembly opens the file once', async () => {
    const { adapterConfig, sequenceAdapter, region } = BAM
    const assembly = { name: 'volvox', sequence: { adapter: sequenceAdapter } }
    await jbrowse.features(JSON.stringify({ adapterConfig, region, assembly }))
    expect((await cache()).adapters).toBe(2)
    expect(new Set(wholeReads.values())).toEqual(new Set([1]))
  })

  test('keeps no chunks under a limit of 0', async () => {
    const { bamLocation, index } = BAM.adapterConfig
    await cache({ limit: 0 })
    await jbrowse.alignments(JSON.stringify(BAM))
    await jbrowse.alignments(JSON.stringify(CRAM))
    rangeBytes.clear()
    wholeReads.clear()
    await jbrowse.alignments(JSON.stringify(BAM))
    expect(wholeReads.get(index.location.uri)).toBe(1)
    expect(rangeBytes.get(bamLocation.uri)).toBeGreaterThan(0)
    expect((await cache()).chunks).toBe(0)
  })

  test('reports the chunks it holds, and lowering the limit evicts them', async () => {
    const { bamLocation } = BAM.adapterConfig
    await jbrowse.alignments(JSON.stringify(BAM))
    await jbrowse.alignments(JSON.stringify(CRAM))
    const read = [...rangeBytes.values()].reduce((a, b) => a + b, 0)
    expect((await cache()).chunks).toBe(read)
    const limit = Math.floor(read / 2)
    const kept = (await cache({ limit })).chunks
    expect(kept).toBeGreaterThan(0)
    expect(kept).toBeLessThanOrEqual(limit)
    rangeBytes.clear()
    await jbrowse.alignments(JSON.stringify(CRAM))
    await jbrowse.alignments(JSON.stringify(BAM))
    expect(rangeBytes.get(bamLocation.uri)).toBeGreaterThan(0)
  })

  test('keeps the files read most recently open while they fit the limit', async () => {
    const { bamLocation, index } = BAM.adapterConfig
    const copy = (i: number) =>
      JSON.stringify({
        ...BAM,
        adapterConfig: {
          ...BAM.adapterConfig,
          bamLocation: { uri: `${bamLocation.uri}?copy=${i}` },
          index: {
            ...index,
            location: { uri: `${index.location.uri}?copy=${i}` },
          },
        },
      })
    await cache({ limit: 3 * MIN_ADAPTER_BYTES })
    for (let i = 0; i < 8; i++) {
      await jbrowse.alignments(copy(i))
    }
    wholeReads.clear()
    await jbrowse.alignments(copy(6))
    expect(wholeReads.size).toBe(0)
    await jbrowse.alignments(copy(0))
    expect(wholeReads.get(`${index.location.uri}?copy=0`)).toBe(1)
  })

  test('weighs a gzipped file read whole by what it inflates to', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'tables-'))
    const vcf = path.join(dir, 'whole.vcf.gz')
    const records = Array.from(
      { length: 40_000 },
      (_, i) => `ctgA\t${i + 1}\t.\tA\tG\t50\tPASS\tNOTE=${'x'.repeat(200)}\n`,
    )
    const text = `##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n${records.join('')}`
    writeFileSync(vcf, gzipSync(text))
    expect(statSync(vcf).size * 10).toBeLessThan(text.length)
    await jbrowse.features(
      JSON.stringify({
        adapterConfig: {
          type: 'VcfAdapter',
          vcfLocation: { uri: pathToFileURL(vcf).href },
        },
        region: { refName: 'ctgA', start: 0, end: 100 },
      }),
    )
    expect((await cache()).parsed).toBeGreaterThanOrEqual(text.length)
  })

  test('weighs a tabix index by what it inflates to, not its file size', async () => {
    const vcf = (file: string) =>
      pathToFileURL(path.resolve('test_data/breakpoint', file)).href
    const tbi = vcf('hs37d5.HG002-SequelII-CCS.sv.vcf.gz.tbi')
    const variants = JSON.stringify({
      adapterConfig: {
        type: 'VcfTabixAdapter',
        vcfGzLocation: { uri: vcf('hs37d5.HG002-SequelII-CCS.sv.vcf.gz') },
        index: { location: { uri: tbi } },
      },
      region: { refName: '1', start: 0, end: 100_000 },
    })
    const tbiReads = async (limit: number) => {
      await jbrowse.clearCache()
      wholeReads.clear()
      await cache({ limit })
      await jbrowse.variants(variants)
      await jbrowse.alignments(JSON.stringify(BAM))
      await jbrowse.variants(variants)
      return wholeReads.get(tbi)
    }
    expect(statSync(fileURLToPath(tbi)).size).toBeLessThan(MIN_ADAPTER_BYTES)
    expect(await tbiReads(4 * MIN_ADAPTER_BYTES)).toBe(2)
    expect(await tbiReads(16 * MIN_ADAPTER_BYTES)).toBe(1)
  })

  test('weighs an adapter by the files it read whole', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'tables-'))
    const gff = path.join(dir, 'big.gff3')
    const lines = Array.from(
      { length: 50_000 },
      (_, i) => `ctgA\tt\tgene\t${i + 1}\t${i + 10}\t.\t+\t.\tID=g${i}\n`,
    )
    writeFileSync(gff, `##gff-version 3\n${lines.join('')}`)
    const size = statSync(gff).size
    const uri = pathToFileURL(gff).href
    const features = JSON.stringify({
      adapterConfig: { type: 'Gff3Adapter', gffLocation: { uri } },
      region: { refName: 'ctgA', start: 0, end: 100 },
    })
    await cache({ limit: size + MIN_ADAPTER_BYTES / 2 })
    await jbrowse.features(features)
    expect((await cache()).parsed).toBeGreaterThanOrEqual(size)
    await jbrowse.alignments(JSON.stringify(BAM))
    await jbrowse.features(features)
    expect(wholeReads.get(uri)).toBe(2)
  })

  test('clearing empties every cache and keeps the budget', async () => {
    await cache({ limit: 64 * 2 ** 20 })
    await jbrowse.features(JSON.stringify(GFF3))
    expect((await cache()).chunks).toBeGreaterThan(0)
    expect(JSON.parse(await jbrowse.clearCache())).toEqual({
      limit: 64 * 2 ** 20,
      decoded: 0,
      chunks: 0,
      parsed: 0,
      adapters: 0,
      assemblies: 0,
    })
  })
})
