import { readFileSync } from 'node:fs'

import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import ChainAdapter from './ChainAdapter/ChainAdapter.ts'
import chainConfigSchema from './ChainAdapter/configSchema.ts'
import { paf_chain2paf } from './ChainAdapter/util.ts'
import PAFAdapter from './PAFAdapter/PAFAdapter.ts'
import pafConfigSchema from './PAFAdapter/configSchema.ts'
import { parsePafBuffer } from './PAFAdapter/util.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * The same alignment, encoded two ways.
 *
 * `yeast.cigar.paf` and `yeast.cigar.chain` are ten records lifted verbatim out
 * of the R64-vs-YJM1447 alignment the yeast_synteny demo serves — the same
 * minimap2 run written by two different external tools, four of the ten on the
 * minus strand. Neither file was produced by anything in this repo, so agreement
 * between them is evidence about the parsers rather than about a shared
 * assumption: the chain parser has to undo the `qSize - qEnd` flip, rebuild a
 * CIGAR from `size dt dq` triples, and land on the numbers minimap2 wrote in
 * columns 3-9.
 *
 * This is the synteny analogue of `CombinationTest.test.ts`, which pins BAM
 * against CRAM for the same reads.
 */
const CHAIN = require.resolve('./test_data/yeast.cigar.chain')
const PAF = require.resolve('./test_data/yeast.cigar.paf')

const key = (r: {
  tname: string
  tstart: number
  tend: number
  qname: string
  qstart: number
  qend: number
  strand: number
}) =>
  `${r.tname}:${r.tstart}-${r.tend}/${r.qname}:${r.qstart}-${r.qend}/${r.strand}`

const chainRecords = paf_chain2paf(new Uint8Array(readFileSync(CHAIN)))
const pafRecords = parsePafBuffer(new Uint8Array(readFileSync(PAF)))

test('the two files describe the same ten alignments', () => {
  expect(chainRecords).toHaveLength(10)
  expect(pafRecords).toHaveLength(10)
  expect(chainRecords.filter(r => r.strand === -1)).toHaveLength(4)
})

test('chain and PAF agree on every interval, including the minus strand', () => {
  // A chain states its query interval against the reverse-complemented
  // sequence; a PAF states it forward. Getting the flip wrong lands the
  // alignment a chromosome-length away, which is exactly the failure this
  // compares against a file that was never flipped.
  expect(chainRecords.map(key).sort()).toEqual(pafRecords.map(key).sort())
})

test('chain and PAF agree on every CIGAR, byte for byte', () => {
  const paf = new Map(pafRecords.map(r => [key(r), r.extra.cg]))
  for (const r of chainRecords) {
    expect(r.extra.cg).toBe(paf.get(key(r)))
  }
})

function opCounts(cg: string) {
  let m = 0
  let i = 0
  let d = 0
  for (const op of cg.matchAll(/(\d+)([MID])/g)) {
    const n = +op[1]!
    if (op[2] === 'M') {
      m += n
    } else if (op[2] === 'I') {
      i += n
    } else {
      d += n
    }
  }
  return { m, i, d }
}

test("a CIGAR spans the record's own coordinates", () => {
  // The invariant that makes a synteny band and its sub-blocks agree. The delta
  // parser asserts it on the way in; nothing checked it here, and the demo
  // chain track ships 215 records that violate it by up to 20kb.
  for (const r of [...chainRecords, ...pafRecords]) {
    const { m, i, d } = opCounts(r.extra.cg as string)
    expect(m + d).toBe(r.tend - r.tstart)
    expect(m + i).toBe(r.qend - r.qstart)
  }
})

test('a chain reports blockLen the way PAF defines it', () => {
  // M+I+D, so identity means the same thing whichever format an alignment
  // arrived in. `max(qspan, tspan)` undercounted by min(I,D) and read as extra
  // identity on a third of a real liftOver chain, up to +0.17.
  //
  // Asserted on the chain side only: minimap2 writes its own column 11, and on
  // these ten records it sits within 0.06% of M+I+D rather than exactly on it.
  for (const r of chainRecords) {
    const { m, i, d } = opCounts(r.extra.cg)
    expect(r.extra.blockLen).toBe(m + i + d)
  }
})

async function featuresFor(adapter: ChainAdapter | PAFAdapter) {
  const feats = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'NC_001133.9',
        start: 0,
        end: 300_000,
        assemblyName: 'R64',
      })
      .pipe(toArray()),
  )
  return feats
    .map((f: Feature) => ({
      refName: f.get('refName'),
      start: f.get('start'),
      end: f.get('end'),
      strand: f.get('strand'),
      CIGAR: f.get('CIGAR'),
      mate: f.get('mate'),
    }))
    .sort((a, b) => a.start - b.start)
}

test('the two adapters put the same features on the same region', async () => {
  const assemblyNames = ['YJM1447', 'R64']
  const chain = new ChainAdapter(
    chainConfigSchema.create({
      chainLocation: { localPath: CHAIN, locationType: 'LocalPathLocation' },
      assemblyNames,
    }),
  )
  const paf = new PAFAdapter(
    pafConfigSchema.create({
      pafLocation: { localPath: PAF, locationType: 'LocalPathLocation' },
      assemblyNames,
    }),
  )
  const [fromChain, fromPaf] = await Promise.all([
    featuresFor(chain),
    featuresFor(paf),
  ])
  expect(fromChain.length).toBeGreaterThan(0)
  expect(fromChain).toEqual(fromPaf)
})
