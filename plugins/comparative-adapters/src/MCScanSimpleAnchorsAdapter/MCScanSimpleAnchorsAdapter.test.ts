import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './MCScanSimpleAnchorsAdapter.ts'
import configSchema from './configSchema.ts'

const bed1 = [
  'chr1\t100\t200\tg1a\t0\t+',
  'chr1\t900\t1000\tg1b\t0\t+',
  'chr1\t2000\t2100\tg1c\t0\t+',
].join('\n')

const bed2 = ['ctgA\t500\t600\tg2a\t0\t+', 'ctgA\t1500\t1600\tg2b\t0\t+'].join(
  '\n',
)

function makeAdapter(simpleAnchors: string) {
  const dir = mkdtempSync(join(tmpdir(), 'mcscan-simple-'))
  const write = (name: string, text: string) => {
    const path = join(dir, name)
    writeFileSync(path, `${text}\n`)
    return { localPath: path, locationType: 'LocalPathLocation' as const }
  }
  return new Adapter(
    configSchema.create({
      bed1Location: write('a.bed', bed1),
      bed2Location: write('b.bed', bed2),
      mcscanSimpleAnchorsLocation: write('in.anchors.simple', simpleAnchors),
      assemblyNames: ['grape', 'peach'],
    }),
  )
}

const block = 'g1a\tg1b\tg2a\tg2b\t50\t-'

const feats = (adapter: Adapter, assemblyName: string, refName: string) =>
  firstValueFrom(
    adapter
      .getFeatures({ refName, start: 0, end: 10000, assemblyName })
      .pipe(toArray()),
  )

test('a block spans its first and last gene on each side', async () => {
  const adapter = makeAdapter(block)
  const [f] = await feats(adapter, 'grape', 'chr1')
  expect(f!.get('start')).toBe(100)
  expect(f!.get('end')).toBe(1000)
  // the file's own orientation column, not the product of the BED strands
  expect(f!.get('strand')).toBe(-1)
  expect(f!.get('score')).toBe(50)
  expect(f!.get('mate')).toEqual({
    refName: 'ctgA',
    start: 500,
    end: 1600,
    name: 'g2a-g2b',
    score: 0,
    strand: 1,
    assemblyName: 'peach',
  })
})

// each band renders the same source row from its own side, so the two features
// must not collide on uniqueId — feature-by-id lookup and selection key on it
test('the two sides of a block get distinct ids', async () => {
  const adapter = makeAdapter(block)
  const [q] = await feats(adapter, 'grape', 'chr1')
  const [t] = await feats(adapter, 'peach', 'ctgA')
  expect(q!.id()).not.toBe(t!.id())
  expect(q!.get('syntenyId')).toBe(t!.get('syntenyId'))
})

// a `.anchors.simple` naming a gene the BED lacks is one undrawable row, not a
// reason to fail the whole track
test('skips a row whose gene is missing from the BED', async () => {
  const adapter = makeAdapter(
    [block, 'g1a\tg1c\tg2a\tmissing\t10\t+'].join('\n'),
  )
  const fa = await feats(adapter, 'grape', 'chr1')
  expect(fa.length).toBe(1)
})

test('throws when no row joins at all', async () => {
  const adapter = makeAdapter('nope1\tnope2\tnope3\tnope4\t10\t+')
  await expect(feats(adapter, 'grape', 'chr1')).rejects.toThrow(
    /name genes present in both BED files/,
  )
})

test('getRefNames reports the side facing each assembly', async () => {
  const adapter = makeAdapter(block)
  expect(await adapter.getRefNames({ assemblyName: 'grape' })).toEqual(['chr1'])
  expect(await adapter.getRefNames({ assemblyName: 'peach' })).toEqual(['ctgA'])
  expect(await adapter.getRefNames({ assemblyName: 'other' })).toEqual([])
})
