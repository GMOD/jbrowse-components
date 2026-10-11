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
import { BAM, CRAM } from './volvox.fixture.ts'

// A host with no web globals at all, as R's V8 is: an empty vm context, where
// the only thing the bundle is handed is a synchronous byte reader.
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

let jbrowse: { alignments: (args: string) => Promise<string> }
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
  vm.runInNewContext(code, sandbox)
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
  },
)
