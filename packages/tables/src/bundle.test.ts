import { execFileSync } from 'node:child_process'
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import { parse } from 'acorn'

import { createTablesEngine } from './index.ts'
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

// A host with no web globals at all, as R's V8 is: an empty vm context, less
// the `Intl` R's V8 is built without, where the only thing the bundle is
// handed is a synchronous byte reader.
function readRange(url: string, start: number, end: number) {
  const file = fileURLToPath(url)
  const size = statSync(file).size
  const last = end < 0 ? size - 1 : Math.min(end, size - 1)
  const bytes = new Uint8Array(Math.max(0, last - start + 1))
  const fd = openSync(file, 'r')
  readSync(fd, bytes, 0, bytes.length, start)
  closeSync(fd)
  return { status: end < 0 && start === 0 ? 200 : 206, size, bytes }
}

let jbrowse: {
  alignments: (args: string) => Promise<string>
  features: (args: string) => Promise<string>
  wiggle: (args: string) => Promise<string>
  variants: (args: string) => Promise<string>
  synteny: (args: string) => Promise<string>
  dotplot: (args: string) => Promise<string>
  contigs: (args: string) => Promise<string>
  multiway: (args: string) => Promise<string>
}
let code: string

beforeAll(() => {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'tables-')), 'b.js')
  execFileSync(
    process.execPath,
    [path.join(__dirname, '../scripts/build-bundle.mjs'), out],
    { env: { ...process.env, MINIFY: '0' } },
  )
  code = readFileSync(out, 'utf8')
  const sandbox: Record<string, unknown> = { jbrowseHost: { readRange } }
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
    const bare = JSON.parse(await jbrowse.alignments(JSON.stringify(args)))
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
    const bare = JSON.parse(await jbrowse.features(JSON.stringify(args)))
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
    const bare = JSON.parse(await jbrowse.wiggle(JSON.stringify(args)))
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
    const bare = JSON.parse(await jbrowse.variants(JSON.stringify(args)))
    const direct = await createTablesEngine().variants(args)
    expect(bare.cells.variant.length).toBeGreaterThan(0)
    const { id: _bareId, ...bareVariants } = bare.variants
    const { id: _directId, ...directVariants } = direct.variants
    expect(bareVariants).toEqual(directVariants)
    expect(bare.cells).toEqual(direct.cells)
    expect(bare.legend).toEqual(direct.legend)
  },
)

test('the bundle answers a PAF as the engine does, in a bare host', async () => {
  const bare = JSON.parse(await jbrowse.synteny(JSON.stringify(INV_INDELS)))
  const direct = await createTablesEngine().synteny(INV_INDELS)
  expect(bare.ribbons.kind.length).toBeGreaterThan(7)
  const { id: _bareId, ...bareAlignments } = bare.alignments
  const { id: _directId, ...directAlignments } = direct.alignments
  expect(bareAlignments).toEqual(directAlignments)
  expect(bare.ribbons).toEqual(direct.ribbons)
  expect(bare.legend).toEqual(direct.legend)

  const bareDots = JSON.parse(
    await jbrowse.dotplot(JSON.stringify(INV_INDELS_DOTPLOT)),
  )
  const directDots = await createTablesEngine().dotplot(INV_INDELS_DOTPLOT)
  expect(bareDots.segments).toEqual(directDots.segments)

  const args = { adapterConfig: INV_INDELS.adapterConfig }
  expect(JSON.parse(await jbrowse.contigs(JSON.stringify(args)))).toEqual(
    await createTablesEngine().contigs(args),
  )
})

test('the bundle stacks a multi-genome PAF as the engine does, in a bare host', async () => {
  for (const args of [ALL_VS_ALL, SYRI]) {
    const bare = JSON.parse(await jbrowse.multiway(JSON.stringify(args)))
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
