import { LocalFile } from 'generic-filehandle2'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import CramAdapter from '../CramAdapter/CramAdapter.ts'
import { SequenceAdapter } from '../CramAdapter/CramTestAdapters.ts'
import cramConfigSchema from '../CramAdapter/configSchema.ts'
import {
  buildReadNameBlock,
  namesToBlock,
  readNameAt,
} from './readNameBlock.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'

// getVolvoxSequenceSubAdapter ignores it and returns the test adapter
const sequenceAdapterConfig = { type: 'TestSequenceAdapter' }

const query = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 1,
  end: 10200,
}

const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => ({
  dataAdapter: new SequenceAdapter(
    new LocalFile(require.resolve('../../test_data/volvox.fa')),
  ),
  sessionIds: new Set(),
})

function localPath(path: string) {
  return { localPath: require.resolve(path), locationType: 'LocalPathLocation' }
}

async function bamFeatures() {
  const adapter = new BamAdapter(
    bamConfigSchema.create({
      bamLocation: localPath('../../test_data/volvox-sorted.bam'),
      index: { location: localPath('../../test_data/volvox-sorted.bam.bai') },
    }),
    getVolvoxSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)
  return firstValueFrom(adapter.getFeatures(query).pipe(toArray()))
}

async function cramFeatures() {
  const adapter = new CramAdapter(
    cramConfigSchema.create({
      cramLocation: localPath('../../test_data/volvox-sorted.cram'),
      craiLocation: localPath('../../test_data/volvox-sorted.cram.crai'),
    }),
    getVolvoxSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)
  return firstValueFrom(adapter.getFeatures(query).pipe(toArray()))
}

// The contract in one line: whatever path built the block, slicing name `i` out
// of it gives back exactly what `feature.get('name')` would have returned. The
// BAM path never asks a feature for its name at all — it copies bytes and
// decodes once — so this is the only thing standing between it and a silently
// misaligned set of names.
function expectNamesRoundTrip(features: Feature[]) {
  const block = buildReadNameBlock(features)
  expect(features.length).toBeGreaterThan(0)
  // An empty block passes a per-name check that also reads '' — so the total
  // length is asserted against the names themselves first.
  expect(block.readNameBlock.length).toBe(
    features.reduce((a, f) => a + f.get('name')!.length, 0),
  )
  for (let i = 0; i < features.length; i++) {
    expect(readNameAt(block, i)).toBe(features[i]!.get('name'))
  }
  return block
}

test('BAM builds the block from record bytes, not from name strings', async () => {
  const features = await bamFeatures()
  // Which path ran is asserted, not assumed. When the accessor changed shape the
  // benchmark's stand-in stopped matching this interface, `buildReadNameBlock`
  // silently took the join path over a `get()` that returned undefined, and
  // produced an EMPTY block that every other check was happy with.
  expect(
    (features[0] as Feature & { copyNameInto?: unknown }).copyNameInto,
  ).toBeInstanceOf(Function)
  const block = expectNamesRoundTrip(features)
  expect(block.readNameOffsets.length).toBe(features.length + 1)
  expect(block.readNameBlock.length).toBe(
    block.readNameOffsets[features.length],
  )
}, 20000)

test('CRAM joins the names it already holds', async () => {
  const features = await cramFeatures()
  expect(
    (features[0] as Feature & { copyNameInto?: unknown }).copyNameInto,
  ).toBeUndefined()
  expectNamesRoundTrip(features)
}, 20000)

describe('namesToBlock', () => {
  test('offsets are cumulative and one longer than the names', () => {
    const b = namesToBlock(['ab', 'cde', 'f'])
    expect(b.readNameBlock).toBe('abcdef')
    expect([...b.readNameOffsets]).toEqual([0, 2, 5, 6])
  })

  // A PAF/synteny block carries no QNAME, and `groupReadsByName` skips a read
  // on the empty string — so an empty name has to survive as one rather than
  // shifting every name after it.
  test('an empty name keeps its slot', () => {
    const b = namesToBlock(['a', '', 'b'])
    expect(readNameAt(b, 0)).toBe('a')
    expect(readNameAt(b, 1)).toBe('')
    expect(readNameAt(b, 2)).toBe('b')
  })

  test('no names is an empty block with one offset', () => {
    const b = namesToBlock([])
    expect(b.readNameBlock).toBe('')
    expect([...b.readNameOffsets]).toEqual([0])
    expect(readNameAt(b, 0)).toBe('')
  })
})

describe('buildReadNameBlock', () => {
  const feat = (name: string, withBytes: boolean) =>
    ({
      get: (field: string) => (field === 'name' ? name : undefined),
      ...(withBytes
        ? {
            nameLength: name.length,
            copyNameInto: (dest: Uint8Array, at: number) => {
              for (let i = 0; i < name.length; i++) {
                dest[at + i] = name.charCodeAt(i)
              }
            },
          }
        : {}),
    }) as unknown as Feature

  test('the byte path decodes what the join path joins', () => {
    const names = ['r1', 'read-two', 'x']
    const fromBytes = buildReadNameBlock(names.map(n => feat(n, true)))
    expect(fromBytes).toEqual(namesToBlock(names))
  })

  // A read with no name is a zero-length view, and the offsets still have to
  // land every later name where it belongs.
  test('the byte path keeps an empty name in place', () => {
    const b = buildReadNameBlock([
      feat('a', true),
      feat('', true),
      feat('bb', true),
    ])
    expect([readNameAt(b, 0), readNameAt(b, 1), readNameAt(b, 2)]).toEqual([
      'a',
      '',
      'bb',
    ])
  })

  test('no features is an empty block', () => {
    expect(buildReadNameBlock([])).toEqual(namesToBlock([]))
  })
})
