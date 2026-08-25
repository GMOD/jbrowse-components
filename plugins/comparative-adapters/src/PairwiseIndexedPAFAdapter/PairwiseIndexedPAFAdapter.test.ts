import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter, { pickPifPrefix } from './PairwiseIndexedPAFAdapter.ts'
import MyConfigSchema from './configSchema.ts'

interface Mate {
  refName: string
  assemblyName: string
  start: number
  end: number
}

function makeAdapter(
  pifFile: string,
  assemblyNames: string[],
  indexType: 'TBI' | 'CSI' = 'TBI',
) {
  return new Adapter(
    MyConfigSchema.create({
      pifGzLocation: {
        localPath: pifFile,
        locationType: 'LocalPathLocation',
      },
      index: {
        indexType,
        location: {
          localPath: `${pifFile}.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      assemblyNames,
    }),
  )
}

const pifInsPath =
  require.resolve('../../../../test_data/volvox/volvox_ins.pif.gz')
const pifDelPath =
  require.resolve('../../../../test_data/volvox/volvox_del.pif.gz')
// volvox_ins_coarse.pif.gz is `jbrowse make-pif` on volvox_ins.paf with the
// default coarse tier, so it carries the uppercase T/Q no-CIGAR rows alongside
// the fine tier.
const pifInsCoarsePath =
  require.resolve('../../../../test_data/volvox/volvox_ins_coarse.pif.gz')
describe('PairwiseIndexedPAFAdapter', () => {
  describe('coordinate extraction from PIF format', () => {
    it('fetches features from query assembly perspective (q-lines)', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])

      const features = adapter.getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 60000,
        assemblyName: 'volvox_ins',
      })

      const featuresArray = await firstValueFrom(features.pipe(toArray()))
      expect(featuresArray.length).toBe(1)

      const feature = featuresArray[0]!
      expect(feature.get('refName')).toBe('ctgA')
      expect(feature.get('assemblyName')).toBe('volvox_ins')
      expect(feature.get('start')).toBe(0)
      expect(feature.get('end')).toBe(54801)

      const mate = feature.get('mate') as Mate
      expect(mate.refName).toBe('ctgA')
      expect(mate.assemblyName).toBe('volvox')
      expect(mate.start).toBe(0)
      expect(mate.end).toBe(50001)
    })

    it('fetches features from target assembly perspective (t-lines)', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])

      const features = adapter.getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 60000,
        assemblyName: 'volvox',
      })

      const featuresArray = await firstValueFrom(features.pipe(toArray()))
      expect(featuresArray.length).toBe(1)

      const feature = featuresArray[0]!
      expect(feature.get('refName')).toBe('ctgA')
      expect(feature.get('assemblyName')).toBe('volvox')
      expect(feature.get('start')).toBe(0)
      expect(feature.get('end')).toBe(50001)

      const mate = feature.get('mate') as Mate
      expect(mate.refName).toBe('ctgA')
      expect(mate.assemblyName).toBe('volvox_ins')
      expect(mate.start).toBe(0)
      expect(mate.end).toBe(54801)
    })

    it('returns consistent coordinates regardless of query perspective', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])

      const queryFeatures = await firstValueFrom(
        adapter
          .getFeatures({
            refName: 'ctgA',
            start: 0,
            end: 60000,
            assemblyName: 'volvox_ins',
          })
          .pipe(toArray()),
      )

      const targetFeatures = await firstValueFrom(
        adapter
          .getFeatures({
            refName: 'ctgA',
            start: 0,
            end: 60000,
            assemblyName: 'volvox',
          })
          .pipe(toArray()),
      )

      const qFeature = queryFeatures[0]!
      const tFeature = targetFeatures[0]!

      const qMate = qFeature.get('mate') as Mate
      const tMate = tFeature.get('mate') as Mate
      expect(qFeature.get('start')).toBe(tMate.start)
      expect(qFeature.get('end')).toBe(tMate.end)
      expect(qMate.start).toBe(tFeature.get('start'))
      expect(qMate.end).toBe(tFeature.get('end'))
    })
  })

  describe('CIGAR handling', () => {
    it('uses pre-computed CIGAR from q-lines (D operation for query perspective)', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])

      const features = await firstValueFrom(
        adapter
          .getFeatures({
            refName: 'ctgA',
            start: 0,
            end: 60000,
            assemblyName: 'volvox_ins',
          })
          .pipe(toArray()),
      )

      const cigar = features[0]!.get('CIGAR')
      expect(cigar).toBe('31198M4800D18803M')
    })

    it('uses pre-computed CIGAR from t-lines (I operation for target perspective)', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])

      const features = await firstValueFrom(
        adapter
          .getFeatures({
            refName: 'ctgA',
            start: 0,
            end: 60000,
            assemblyName: 'volvox',
          })
          .pipe(toArray()),
      )

      const cigar = features[0]!.get('CIGAR')
      expect(cigar).toBe('31198M4800I18803M')
    })
  })

  describe('deletion test file', () => {
    it('fetches features with correct coordinates from del file', async () => {
      const adapter = makeAdapter(pifDelPath, ['volvox_del', 'volvox'])

      const queryFeatures = await firstValueFrom(
        adapter
          .getFeatures({
            refName: 'ctgA',
            start: 0,
            end: 60000,
            assemblyName: 'volvox_del',
          })
          .pipe(toArray()),
      )

      expect(queryFeatures.length).toBe(1)
      const feature = queryFeatures[0]!
      const mate = feature.get('mate') as Mate
      expect(feature.get('start')).toBe(0)
      expect(feature.get('end')).toBe(45141)
      expect(mate.start).toBe(0)
      expect(mate.end).toBe(50001)
    })
  })

  describe('getRefNames', () => {
    it('returns query reference names for query assembly', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])
      const refNames = await adapter.getRefNames({
        assemblyName: 'volvox_ins',
      })
      expect(refNames).toContain('ctgA')
    })

    it('returns target reference names for target assembly', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])
      const refNames = await adapter.getRefNames({
        assemblyName: 'volvox',
      })
      expect(refNames).toContain('ctgA')
    })

    // -1 from the shared side rule, and the empty answer is what the other
    // three pairwise adapters give. This one used to throw on a missing name,
    // which made "the caller has not resolved an assembly yet" an error here
    // and an ordinary [] everywhere else.
    it('answers empty for an unlisted assembly, and for none at all', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])
      expect(await adapter.getRefNames({ assemblyName: 'mouse' })).toEqual([])
      expect(await adapter.getRefNames({})).toEqual([])
    })
  })

  // The prefix is the perspective letter (flip) upper-cased for the coarse tier.
  // The tier itself arrives already resolved — the zoom-based 'auto' decision is
  // resolveLodTier's, on the main thread, so it lands in the fetch cache key.
  describe('LOD prefix selection', () => {
    const cases = [
      // [name, flip, hasCoarseTier, lodMode, expected]
      ['target perspective, fine tier', false, true, 'fine', 't'],
      ['query perspective, fine tier', true, true, 'fine', 'q'],
      ['target perspective, coarse tier', false, true, 'coarse', 'T'],
      ['query perspective, coarse tier', true, true, 'coarse', 'Q'],
      ['no stated tier reads fine', false, true, undefined, 't'],
      [
        'coarse degrades to fine when the file has none',
        false,
        false,
        'coarse',
        't',
      ],
      ['query side degrades to fine too', true, false, 'coarse', 'q'],
    ] as const
    for (const [name, flip, hasCoarseTier, lodMode, expected] of cases) {
      it(name, () => {
        expect(pickPifPrefix({ flip, hasCoarseTier, lodMode })).toBe(expected)
      })
    }

    it('uses fine tier when fixture has no T/Q tier even if coarse is asked for', async () => {
      // Locks in the integration behavior the unit-test asserts: asking an
      // adapter pointed at a fine-only fixture for the coarse tier must still
      // return features, not silently degrade to zero.
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])
      const features = await firstValueFrom(
        adapter
          .getFeatures(
            {
              refName: 'ctgA',
              start: 0,
              end: 60000,
              assemblyName: 'volvox',
            },
            { lodMode: 'coarse' },
          )
          .pipe(toArray()),
      )
      expect(features.length).toBe(1)
    })
  })

  describe('coarse tier integration', () => {
    it('serves fine-tier features (with CIGAR) when the fine tier is asked for', async () => {
      const adapter = makeAdapter(pifInsCoarsePath, ['volvox_ins', 'volvox'])
      const features = await firstValueFrom(
        adapter
          .getFeatures(
            { refName: 'ctgA', start: 0, end: 60000, assemblyName: 'volvox' },
            { lodMode: 'fine' },
          )
          .pipe(toArray()),
      )
      expect(features.length).toBe(1)
      expect(features[0]!.get('CIGAR')).toBe('31198M4800I18803M')
    })

    it('serves coarse-tier features (no CIGAR) when the coarse tier is asked for', async () => {
      const adapter = makeAdapter(pifInsCoarsePath, ['volvox_ins', 'volvox'])
      const features = await firstValueFrom(
        adapter
          .getFeatures(
            { refName: 'ctgA', start: 0, end: 60000, assemblyName: 'volvox' },
            { lodMode: 'coarse' },
          )
          .pipe(toArray()),
      )
      expect(features.length).toBe(1)
      const feature = features[0]!
      // The coarse T-row carries the same target-perspective coords as the fine
      // row but no CIGAR — it is the whole-genome LOD summary.
      expect(feature.get('CIGAR')).toBeUndefined()
      expect(feature.get('start')).toBe(0)
      expect(feature.get('end')).toBe(50001)
    })
  })

  // A self-alignment names one assembly on both sides, and PIF files the two
  // perspectives of a row under separate q/t seqids. Picking the side by first
  // match read the q-lines for every query, so the t-perspective of every row
  // was never seeked for and half the alignment did not draw.
  describe('self-alignment', () => {
    it('reads both the q and t seqids of the queried contig', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox', 'volvox'])
      const features = await firstValueFrom(
        adapter
          .getFeatures({
            refName: 'ctgA',
            start: 0,
            end: 60000,
            assemblyName: 'volvox',
          })
          .pipe(toArray()),
      )
      expect(features.length).toBe(2)
      // the q-line's CIGAR carries the 4800bp as a deletion, the t-line's as an
      // insertion: the same alignment from its two ends
      expect(features.map(f => f.get('CIGAR')).sort()).toEqual([
        '31198M4800D18803M',
        '31198M4800I18803M',
      ])
      expect(new Set(features.map(f => f.id())).size).toBe(2)
    })

    it('reports the contigs of both perspectives, undoubled', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox', 'volvox'])
      expect(await adapter.getRefNames({ assemblyName: 'volvox' })).toEqual([
        'ctgA',
      ])
    })
  })

  describe('getAssemblyNames', () => {
    it('returns assembly names from config', () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])
      expect(adapter.getAssemblyNames()).toEqual(['volvox_ins', 'volvox'])
    })

    it('returns assembly names from queryAssembly/targetAssembly config', () => {
      const adapter = new Adapter(
        MyConfigSchema.create({
          pifGzLocation: {
            localPath: pifInsPath,
            locationType: 'LocalPathLocation',
          },
          index: {
            location: {
              localPath: `${pifInsPath}.tbi`,
              locationType: 'LocalPathLocation',
            },
          },
          queryAssembly: 'query_asm',
          targetAssembly: 'target_asm',
        }),
      )
      expect(adapter.getAssemblyNames()).toEqual(['query_asm', 'target_asm'])
    })
  })
})
