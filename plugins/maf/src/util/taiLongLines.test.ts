import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'

import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BgzipTaffyAdapter from '../BgzipTaffyAdapter/BgzipTaffyAdapter.ts'
import bgzipTaffyConfigSchema from '../BgzipTaffyAdapter/configSchema.ts'

const rowCount = 1200
const chromosomes = [
  { name: 'chrS', blockCount: 30 },
  { name: 'chrT', blockCount: 3 },
]
const columnsPerBlock = 5
const blockStride = columnsPerBlock + 2
const firstStart = 1000
const chunkSize = 20_000
const wholeChromosomeEnd = 2 ** 31 - 1

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
  const rowName = (chromosome: string, row: number) =>
    row === 0 ? `ref.${chromosome}` : `sp${row}.contig${row}`
  let seed = 7
  const base = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
    return 'ACGT'[(seed >> 16) % 4]!
  }
  const lines = ['#taf version:1']
  const blockStarts: { refName: string; start: number; offset: number }[] = []
  let offset = lines[0]!.length + 1
  for (const { name, blockCount } of chromosomes) {
    for (let block = 0; block < blockCount; block++) {
      const start = firstStart + block * blockStride
      const opcode = block === 0 ? 'i' : 's'
      const instructions = Array.from(
        { length: rowCount },
        (_, row) =>
          `${opcode} ${row} ${rowName(name, row)} ${row === 0 ? start : 50_000 + block * 11 + row} + 10000000`,
      ).join(' ')
      blockStarts.push({ refName: name, start, offset })
      for (let column = 0; column < columnsPerBlock; column++) {
        const bases = Array.from({ length: rowCount }, base).join('')
        const line = column === 0 ? `${bases} ; ${instructions}` : bases
        lines.push(line)
        offset += line.length + 1
      }
    }
  }
  return { text: `${lines.join('\n')}\n`, blockStarts }
}

// A TAF block has no terminator, so the block a query ends in is emitted only
// once the bounding coordinate line has arrived whole. Here that line is ~60 KB
// of stored (level 0) bgzf, so it reaches past the 64 KB of compressed cushion
// that the read adds after the bounding entry's bgzf block. Past a
// chromosome's last entry the bounding line is the next chromosome's first, and
// the expected blocks below come from the generator, not from reading the file
// back.
describe('a bounded TAF read whose bounding coordinate line is wider than the read cushion', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maf-long-lines-'))
  const { text, blockStarts } = tafWithWideCoordinateLines()
  const { file, virtualOffsetAt } = bgzf(Buffer.from(text))
  const tafGz = path.join(dir, 'wide.taf.gz')
  fs.writeFileSync(tafGz, file)

  const makeAdapter = (name: string, shiftFirstBlockOf?: string) => {
    const tai = path.join(dir, `${name}.taf.gz.tai`)
    fs.writeFileSync(
      tai,
      `${blockStarts
        .map(({ refName, start, offset }) => {
          const shifted = refName === shiftFirstBlockOf && start === firstStart
          return `ref.${refName}\t${start}\t${virtualOffsetAt(offset) + (shifted ? 65536 : 0)}`
        })
        .join('\n')}\n`,
    )
    return new BgzipTaffyAdapter(
      bgzipTaffyConfigSchema.create({
        tafGzLocation: { localPath: tafGz, locationType: 'LocalPathLocation' },
        taiLocation: { localPath: tai, locationType: 'LocalPathLocation' },
      }),
    )
  }
  const adapter = makeAdapter('wide')

  const startsOf = (refName: string) =>
    blockStarts.filter(b => b.refName === refName).map(b => b.start)

  const startsRead = async (
    refName: string,
    start: number,
    end: number,
    reader = adapter,
  ) => {
    const features = await firstValueFrom(
      reader
        .getFeatures({ assemblyName: 'test', refName, start, end })
        .pipe(toArray()),
    )
    return features.map(f => f.get('start'))
  }

  const expectedStarts = (refName: string, start: number, end: number) =>
    startsOf(refName).filter(
      blockStart => blockStart < end && blockStart + columnsPerBlock > start,
    )

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const chrS = startsOf('chrS')
  const chrT = startsOf('chrT')
  const lastS = chrS.at(-1)!

  test('the generator made the chromosomes the tests expect', () => {
    expect(chrS).toHaveLength(30)
    expect(chrT).toHaveLength(3)
  })

  test('a whole-chromosome read of a non-last chromosome returns every block', async () => {
    expect(await startsRead('chrS', 0, wholeChromosomeEnd)).toEqual(chrS)
  }, 60_000)

  test('a query in the last bracket of a non-last chromosome returns its last block', async () => {
    expect(await startsRead('chrS', lastS + 1, lastS + 3)).toEqual([lastS])
    expect(await startsRead('chrS', lastS, wholeChromosomeEnd)).toEqual([lastS])
  }, 60_000)

  test('a query ending just before the next chromosome starts keeps the last block', async () => {
    const queries: [number, number][] = [
      [lastS - 3, lastS + columnsPerBlock],
      [lastS - 20, lastS + columnsPerBlock + 1],
      [lastS - 20, lastS + 1000],
    ]
    for (const [start, end] of queries) {
      expect(await startsRead('chrS', start, end)).toEqual(
        expectedStarts('chrS', start, end),
      )
    }
    expect(expectedStarts('chrS', lastS - 3, lastS + columnsPerBlock)).toEqual([
      lastS - blockStride,
      lastS,
    ])
  }, 60_000)

  test('no query loses a block that ends at the bounding entry', async () => {
    const queries = chrS.flatMap((start): [number, number][] => [
      [start - 3, start],
      [start - 3, start + 1],
      [start - 10, start],
      [start, start + columnsPerBlock],
      [start - 1, start + 8],
      [start + 3, wholeChromosomeEnd],
    ])
    const differing: string[] = []
    for (const [start, end] of queries) {
      const got = await startsRead('chrS', start, end)
      const expected = expectedStarts('chrS', start, end)
      if (JSON.stringify(got) !== JSON.stringify(expected)) {
        differing.push(`${start}-${end}: ${got.length} vs ${expected.length}`)
      }
    }
    expect(differing).toEqual([])
  }, 120_000)

  test('queries on the last chromosome are still correct', async () => {
    expect(await startsRead('chrT', 0, wholeChromosomeEnd)).toEqual(chrT)
    expect(await startsRead('chrT', chrT[0]! - 1, chrT[0]! + 3)).toEqual([
      chrT[0],
    ])
    expect(await startsRead('chrT', chrT[2]! + 1, chrT[2]! + 3)).toEqual([
      chrT[2],
    ])
  }, 60_000)

  test('a .tai naming a block the file does not have there throws', async () => {
    const stale = makeAdapter('stale', 'chrT')
    await expect(
      startsRead('chrS', 0, wholeChromosomeEnd, stale),
    ).rejects.toThrow(/\.tai index does not match wide\.taf\.gz.*chrS/)
  })
})
