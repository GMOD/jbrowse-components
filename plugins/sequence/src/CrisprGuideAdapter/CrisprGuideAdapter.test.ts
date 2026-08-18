import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import CrisprGuideAdapter from './CrisprGuideAdapter.ts'
import configSchema from './configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Region } from '@jbrowse/core/util'

// minimal in-memory sequence adapter; only getSequence is exercised
class FakeSequenceAdapter {
  constructor(private seq: string) {}
  async getSequence(region: Region) {
    return this.seq.slice(
      Math.max(0, region.start),
      Math.min(this.seq.length, region.end),
    )
  }
  async getRefNames() {
    return ['chr1']
  }
}

function makeAdapter(seq: string, extraConf: Record<string, unknown> = {}) {
  const getSubAdapter = (async () => ({
    dataAdapter: new FakeSequenceAdapter(seq),
    sessionIds: new Set<string>(),
  })) as unknown as getSubAdapterType
  return new CrisprGuideAdapter(
    configSchema.create({
      sequenceAdapter: { type: 'FakeSequenceAdapter' },
      guideLength: 6,
      ...extraConf,
    }),
    getSubAdapter,
  )
}

function getGuides(adapter: CrisprGuideAdapter, region: Region) {
  return firstValueFrom(adapter.getFeatures(region, {}).pipe(toArray()))
}

test('finds a forward-strand SpCas9 guide with protospacer, PAM, cut site', async () => {
  //          0         1         2
  //          0123456789012345678901234
  const seq = 'ATATATATATAAATTTTGGATATAT'
  //                     ^proto ^PAM(TGG at 16-18)
  const adapter = makeAdapter(seq, { searchReverse: false })
  const guides = await getGuides(adapter, {
    assemblyName: 'volvox',
    refName: 'chr1',
    start: 0,
    end: 25,
  })

  expect(guides).toHaveLength(1)
  const g = guides[0]!
  expect(g.get('strand')).toBe(1)
  expect(g.get('start')).toBe(10)
  expect(g.get('end')).toBe(19)
  expect(g.get('guideSeq')).toBe('AAATTT')
  expect(g.get('pam')).toBe('TGG')
  expect(g.get('cutSite')).toBe(13)
  // AAATTT: no G/C, only 3 consecutive T's (not a poly-T terminator)
  expect(g.get('gcPercent')).toBe(0)
  expect(g.get('hasPolyT')).toBe(false)
  expect(g.get('softMasked')).toBe(false)
  const pamSub = g.get('subfeatures')![0]!
  expect(pamSub.get('start')).toBe(16)
  expect(pamSub.get('end')).toBe(19)
  expect(pamSub.get('type')).toBe('PAM')
})

test('finds a reverse-strand guide and reports guide/PAM in guide orientation', async () => {
  //          0         1         2
  //          012345678901234567890
  const seq = 'ATATATCCAGATTACATATAT'
  //                 ^PAM_rc(CCA 6-8) ^proto(GATTAC 9-14) on plus strand
  const adapter = makeAdapter(seq, { searchForward: false })
  const guides = await getGuides(adapter, {
    assemblyName: 'volvox',
    refName: 'chr1',
    start: 0,
    end: 21,
  })

  expect(guides).toHaveLength(1)
  const g = guides[0]!
  expect(g.get('strand')).toBe(-1)
  expect(g.get('start')).toBe(6)
  expect(g.get('end')).toBe(15)
  // revcomp(GATTAC) reads the guide 5'->3'
  expect(g.get('guideSeq')).toBe('GTAATC')
  // revcomp(CCA) = TGG, an NGG PAM
  expect(g.get('pam')).toBe('TGG')
  expect(g.get('cutSite')).toBe(12)
})

test('a guide whose PAM sits outside the query is still found via the padding', async () => {
  //          0         1         2
  //          0123456789012345678901234
  const seq = 'ATATATATATAAATTTTGGATATAT'
  // the guide spans 10..19 but the query stops at 12, so its PAM is outside
  const adapter = makeAdapter(seq, { searchReverse: false })
  const guides = await getGuides(adapter, {
    assemblyName: 'volvox',
    refName: 'chr1',
    start: 0,
    end: 12,
  })
  expect(guides).toHaveLength(1)
  expect(guides[0]!.get('start')).toBe(10)
})

test('GC and poly-T filters drop guides the caller asked to exclude', async () => {
  //          0         1         2
  //          0123456789012345678901234
  const seq = 'ATATATATATAAATTTTGGATATAT'
  // the only guide is AAATTT: 0% GC, no TTTT run
  const kept = await getGuides(
    makeAdapter(seq, { searchReverse: false, maxGcPercent: 50 }),
    { assemblyName: 'volvox', refName: 'chr1', start: 0, end: 25 },
  )
  expect(kept).toHaveLength(1)

  const dropped = await getGuides(
    makeAdapter(seq, { searchReverse: false, minGcPercent: 40 }),
    { assemblyName: 'volvox', refName: 'chr1', start: 0, end: 25 },
  )
  expect(dropped).toHaveLength(0)
})

test('a protospacer reaching into an assembly gap is not a guide', async () => {
  // the PAM (TGG at 16-18) matches as usual — N is a residue, not the IUPAC
  // code N — but the 6bp protospacer in front of it is all gap
  const seq = 'ATATATATATNNNNNNTGGATATAT'
  const guides = await getGuides(makeAdapter(seq, { searchReverse: false }), {
    assemblyName: 'volvox',
    refName: 'chr1',
    start: 0,
    end: 25,
  })
  expect(guides).toHaveLength(0)
})

test('a soft-masked protospacer is flagged and reported uppercase', async () => {
  // the same guide as the first test, in a repeat-masked reference
  const seq = 'ATATATATATaaatttTGGATATAT'
  const guides = await getGuides(makeAdapter(seq, { searchReverse: false }), {
    assemblyName: 'volvox',
    refName: 'chr1',
    start: 0,
    end: 25,
  })
  expect(guides).toHaveLength(1)
  const g = guides[0]!
  expect(g.get('softMasked')).toBe(true)
  // a guide gets copied out of here into an order form, so the case the
  // reference happened to use is not part of the sequence
  expect(g.get('guideSeq')).toBe('AAATTT')
  expect(g.get('name')).toBe('AAATTT')
})

test.each(['', 'XYZ', 'N['])('a PAM of %p is rejected by name', async pam => {
  await expect(
    getGuides(makeAdapter('ATATATATATAAATTTTGGATATAT', { pam }), {
      assemblyName: 'volvox',
      refName: 'chr1',
      start: 0,
      end: 25,
    }),
  ).rejects.toThrow(/Invalid PAM/)
})

test('overlapping PAMs each yield a guide', async () => {
  // GGG contains two NGG PAMs (at the first and second G)
  const seq = 'ATATATATATAAATTTGGGATATAT'
  const adapter = makeAdapter(seq, { searchReverse: false })
  const guides = await getGuides(adapter, {
    assemblyName: 'volvox',
    refName: 'chr1',
    start: 0,
    end: 25,
  })
  expect(guides.length).toBeGreaterThanOrEqual(2)
})
