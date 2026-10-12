import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createTablesEngine } from './index.ts'

const engine = createTablesEngine()

const uri = (file: string) => ({
  uri: pathToFileURL(path.resolve(file)).href,
  locationType: 'UriLocation',
})

test('a PAF lists each side’s contigs in file order with the lengths it states', async () => {
  const t = await engine.contigs({
    adapterConfig: {
      type: 'PAFAdapter',
      pafLocation: uri('test_data/peach_grape_small.paf.gz'),
      assemblyNames: ['peach', 'grape'],
    },
  })
  expect(t.query.assemblyName).toBe('peach')
  expect(t.target.assemblyName).toBe('grape')
  expect(t.query.refName.slice(0, 3)).toEqual(['Pp07', 'Pp03', 'Pp02'])
  expect(t.query.length.slice(0, 3)).toEqual([22388614, 27368013, 30405870])
  expect(t.query.refName).toHaveLength(13)
  expect(t.target.refName).toHaveLength(24)
  expect(t.target.refName[0]).toBe('chr9')
  expect(t.target.length[0]).toBe(23006712)
})

test('delta and chain headers give their contigs’ lengths', async () => {
  const delta = await engine.contigs({
    adapterConfig: {
      type: 'DeltaAdapter',
      deltaLocation: uri(
        'plugins/comparative-adapters/src/test_data/yeast.delta',
      ),
      assemblyNames: ['yjm1447', 'r64'],
    },
  })
  expect(delta.query.refName[0]).toBe('I')
  expect(delta.query.length[0]).toBe(198540)
  expect(delta.target.refName[0]).toBe('NC_001133.9')
  expect(delta.target.length[0]).toBe(230218)

  const chain = await engine.contigs({
    adapterConfig: {
      type: 'ChainAdapter',
      chainLocation: uri(
        'plugins/comparative-adapters/src/test_data/yeast.cigar.chain',
      ),
      assemblyNames: ['yjm1447', 'r64'],
    },
  })
  expect(chain.query.refName[0]).toBe('I')
  expect(chain.query.length[0]).toBe(198540)
  expect(chain.target.length[0]).toBe(230218)
})

test('a MashMap file states both lengths on each row', async () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'mashmap-')), 'a.out')
  writeFileSync(
    file,
    'ctgA 50001 0 20000 + chrA 60000 100 20100 98.5\nctgB 7000 0 5000 - chrA 60000 30000 35000 97\n',
  )
  const t = await engine.contigs({
    adapterConfig: {
      type: 'MashMapAdapter',
      outLocation: uri(file),
      assemblyNames: ['q', 't'],
    },
  })
  expect(t.query).toEqual({
    assemblyName: 'q',
    refName: ['ctgA', 'ctgB'],
    length: [50001, 7000],
  })
  expect(t.target.length).toEqual([60000])
})

test('an indexed PIF reads each contig’s length off its first row', async () => {
  const t = await engine.contigs({
    adapterConfig: {
      type: 'PairwiseIndexedPAFAdapter',
      pifGzLocation: uri('test_data/volvox/volvox_del.pif.gz'),
      index: { location: uri('test_data/volvox/volvox_del.pif.gz.tbi') },
      assemblyNames: ['volvox_del', 'volvox'],
    },
  })
  expect(t.query).toEqual({
    assemblyName: 'volvox_del',
    refName: ['ctgA'],
    length: [45141],
  })
  expect(t.target.length).toEqual([50001])
})

test('an adapter that cannot state lengths lists its contigs without them', async () => {
  const data = 'plugins/comparative-adapters/src/MCScanAnchorsAdapter/test_data'
  const t = await engine.contigs({
    adapterConfig: {
      type: 'MCScanAnchorsAdapter',
      mcscanAnchorsLocation: uri(`${data}/grape.peach.anchors.gz`),
      bed1Location: uri(`${data}/grape.bed.gz`),
      bed2Location: uri(`${data}/peach.bed.gz`),
      assemblyNames: ['grape', 'peach'],
    },
  })
  expect(t.query.refName.length).toBeGreaterThan(0)
  expect(t.query.length.every(l => l === null)).toBe(true)
  expect(t.target.refName).toContain('Pp01')
})
