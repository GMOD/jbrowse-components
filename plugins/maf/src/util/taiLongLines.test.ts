import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'

import BgzipTaffyAdapter from '../BgzipTaffyAdapter/BgzipTaffyAdapter.ts'
import bgzipTaffyConfigSchema from '../BgzipTaffyAdapter/configSchema.ts'
import { queriesDifferingFromWholeChromosome } from './taiWholeChromosome.fixture.ts'

const rowCount = 1200
const blockCount = 30
const columnsPerBlock = 5
const blockStride = columnsPerBlock + 2
const firstStart = 1000
const chunkSize = 20_000

const BGZF_EOF = Buffer.from(
  '1f8b08040000000000ff0600424302001b0003000000000000000000',
  'hex',
)

function bgzfBlock(chunk: Buffer) {
  const body = deflateRawSync(chunk, { level: 0 })
  const header = Buffer.from('1f8b08040000000000ff0600424302000000', 'hex')
  header.writeUInt16LE(header.length + body.length + 8 - 1, 16)
  const trailer = Buffer.alloc(8)
  trailer.writeUInt32LE(crc32(chunk), 0)
  trailer.writeUInt32LE(chunk.length, 4)
  return Buffer.concat([header, body, trailer])
}

function bgzf(data: Buffer) {
  const blocks: Buffer[] = []
  for (let at = 0; at < data.length; at += chunkSize) {
    blocks.push(bgzfBlock(data.subarray(at, at + chunkSize)))
  }
  const compressedStarts = blocks.reduce<number[]>(
    (starts, block, i) => [...starts, starts[i]! + block.length],
    [0],
  )
  return {
    file: Buffer.concat([...blocks, BGZF_EOF]),
    virtualOffsetAt: (offset: number) =>
      compressedStarts[Math.floor(offset / chunkSize)]! * 65536 +
      (offset % chunkSize),
  }
}

function tafWithWideCoordinateLines() {
  const rowName = (row: number) =>
    row === 0 ? 'ref.chrS' : `sp${row}.contig${row}`
  let seed = 7
  const base = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
    return 'ACGT'[(seed >> 16) % 4]!
  }
  const lines = ['#taf version:1']
  const blockStarts: { start: number; offset: number }[] = []
  let offset = lines[0]!.length + 1
  for (let block = 0; block < blockCount; block++) {
    const start = firstStart + block * blockStride
    const opcode = block === 0 ? 'i' : 's'
    const instructions = Array.from(
      { length: rowCount },
      (_, row) =>
        `${opcode} ${row} ${rowName(row)} ${row === 0 ? start : 50_000 + block * 11 + row} + 10000000`,
    ).join(' ')
    blockStarts.push({ start, offset })
    for (let column = 0; column < columnsPerBlock; column++) {
      const bases = Array.from({ length: rowCount }, base).join('')
      const line = column === 0 ? `${bases} ; ${instructions}` : bases
      lines.push(line)
      offset += line.length + 1
    }
  }
  return { text: `${lines.join('\n')}\n`, blockStarts }
}

// A TAF block has no terminator, so the block a query ends in is emitted only
// once the bounding coordinate line has arrived whole. Here that line is ~60 KB
// of stored (level 0) bgzf, so it reaches past the 64 KB of compressed cushion
// that the read adds after the bounding entry's bgzf block.
describe('a bounded TAF read whose bounding coordinate line is wider than the read cushion', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maf-long-lines-'))
  const { text, blockStarts } = tafWithWideCoordinateLines()
  const { file, virtualOffsetAt } = bgzf(Buffer.from(text))
  const tafGz = path.join(dir, 'wide.taf.gz')
  const tai = path.join(dir, 'wide.taf.gz.tai')
  fs.writeFileSync(tafGz, file)
  fs.writeFileSync(
    tai,
    `${blockStarts
      .map(
        ({ start, offset }) => `ref.chrS\t${start}\t${virtualOffsetAt(offset)}`,
      )
      .join('\n')}\n`,
  )
  const adapter = new BgzipTaffyAdapter(
    bgzipTaffyConfigSchema.create({
      tafGzLocation: { localPath: tafGz, locationType: 'LocalPathLocation' },
      taiLocation: { localPath: tai, locationType: 'LocalPathLocation' },
    }),
  )

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('no query loses a block that ends at the bounding entry', async () => {
    const result = await queriesDifferingFromWholeChromosome(
      adapter,
      'chrS',
      dataEnd =>
        blockStarts.flatMap(({ start }): [number, number][] => [
          [start - 3, start],
          [start - 3, start + 1],
          [start - 10, start],
          [start, start + columnsPerBlock],
          [start - 1, start + 8],
          [start + 3, dataEnd],
        ]),
    )
    expect(result.differing).toEqual([])
    expect(result.features).toBe(blockCount)
    expect(result.nonEmpty).toBeGreaterThan(result.queries / 2)
  }, 60_000)
})
