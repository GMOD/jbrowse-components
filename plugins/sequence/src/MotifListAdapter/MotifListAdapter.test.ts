import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import MotifListAdapter from './MotifListAdapter.ts'
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
  return new MotifListAdapter(
    configSchema.create({
      sequenceAdapter: { type: 'FakeSequenceAdapter' },
      ...extraConf,
    }),
    getSubAdapter,
  )
}

function getMotifs(seq: string, extraConf: Record<string, unknown> = {}) {
  return firstValueFrom(
    makeAdapter(seq, extraConf)
      .getFeatures(
        { assemblyName: 'volvox', refName: 'chr1', start: 0, end: seq.length },
        {},
      )
      .pipe(toArray()),
  )
}

test('EcoRI: one unstranded hit with both cuts and a 5-prime overhang', async () => {
  //                     0123456789
  const feats = await getMotifs('AAAAGAATTCAAAA', {
    motifs: 'EcoRI G^AATTC',
  })

  // both strands are enabled, but a palindrome must not be double-reported
  expect(feats).toHaveLength(1)
  const f = feats[0]!
  expect(f.get('name')).toBe('EcoRI')
  expect(f.get('start')).toBe(4)
  expect(f.get('end')).toBe(10)
  expect(f.get('strand')).toBe(0)
  expect(f.get('cutSite')).toBe(5)
  expect(f.get('cutSiteBottom')).toBe(9)
  expect(f.get('ends')).toBe("5' overhang (4 bp)")
})

test('SmaI cuts blunt, PstI leaves a 3-prime overhang', async () => {
  const [blunt] = await getMotifs('AAAACCCGGGAAAA', { motifs: 'SmaI CCC^GGG' })
  expect(blunt!.get('cutSite')).toBe(7)
  expect(blunt!.get('cutSiteBottom')).toBe(7)
  expect(blunt!.get('ends')).toBe('blunt')

  const [pstI] = await getMotifs('AAAACTGCAGAAAA', { motifs: 'PstI CTGCA^G' })
  expect(pstI!.get('cutSite')).toBe(9)
  expect(pstI!.get('cutSiteBottom')).toBe(5)
  expect(pstI!.get('ends')).toBe("3' overhang (4 bp)")
})

test('a non-palindromic motif hits each strand separately', async () => {
  //          0         1
  //          01234567890123456789
  const seq = 'AAGGTCTCAAAAGAGACCAA'
  // GGTCTC at 2..8 on the plus strand, its revcomp GAGACC at 12..18
  const feats = await getMotifs(seq, { motifs: 'BsaI G^GTCTC' })

  expect(feats).toHaveLength(2)
  const [fwd, rev] = feats
  expect(fwd!.get('strand')).toBe(1)
  expect(fwd!.get('start')).toBe(2)
  // cut sits 1bp from the site's 5' end, which is the low coordinate here
  expect(fwd!.get('cutSite')).toBe(3)

  expect(rev!.get('strand')).toBe(-1)
  expect(rev!.get('start')).toBe(12)
  // on the minus strand the site reads right-to-left, so the cut mirrors
  expect(rev!.get('cutSite')).toBe(17)
  // only a palindrome's notation pins the bottom-strand cut
  expect(rev!.get('cutSiteBottom')).toBeUndefined()
  expect(rev!.get('ends')).toBeUndefined()
})

test('searchReverse=false drops the minus-strand hit', async () => {
  const feats = await getMotifs('AAGGTCTCAAAAGAGACCAA', {
    motifs: 'BsaI GGTCTC',
    searchReverse: false,
  })
  expect(feats).toHaveLength(1)
  expect(feats[0]!.get('strand')).toBe(1)
})

test('a site with no cut notation reports no cut', async () => {
  const [f] = await getMotifs('AAAAGAATTCAAAA', { motifs: 'GAATTC' })
  expect(f!.get('name')).toBe('GAATTC')
  expect(f!.get('cutSite')).toBeUndefined()
  expect(f!.get('ends')).toBeUndefined()
})

test('overlapping tandem sites each yield a hit', async () => {
  // ATAT is palindromic and occurs at 0..4 and 2..6
  const feats = await getMotifs('ATATAT', { motifs: 'ATAT' })
  expect(feats.map(f => f.get('start'))).toEqual([0, 2])
})

test('several motifs share one track and keep distinct ids', async () => {
  const feats = await getMotifs('AAGAATTCAAGGATCCAA', {
    motifs: ['# common cutters', 'EcoRI G^AATTC', 'BamHI G^GATCC'].join('\n'),
  })
  expect(feats.map(f => f.get('name'))).toEqual(['EcoRI', 'BamHI'])
  expect(new Set(feats.map(f => f.id())).size).toBe(2)
})

test('a hit straddling the region edge is still found', async () => {
  const seq = 'AAAAAAAAAAGAATTCAAAAAAAAAA'
  // the region ends mid-site; the padded fetch must still catch it
  const feats = await firstValueFrom(
    makeAdapter(seq, { motifs: 'EcoRI G^AATTC' })
      .getFeatures(
        { assemblyName: 'volvox', refName: 'chr1', start: 0, end: 12 },
        {},
      )
      .pipe(toArray()),
  )
  expect(feats).toHaveLength(1)
  expect(feats[0]!.get('start')).toBe(10)
})
