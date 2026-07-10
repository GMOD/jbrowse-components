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
  })

  describe('LOD prefix selection', () => {
    const cases = [
      // [name, flip, bpPerPx, threshold, hasCoarseTier, expected]
      [
        'fine when bpPerPx below threshold (target)',
        false,
        100,
        10000,
        true,
        't',
      ],
      [
        'fine when bpPerPx below threshold (query)',
        true,
        100,
        10000,
        true,
        'q',
      ],
      [
        'coarse when bpPerPx >= threshold (target)',
        false,
        50000,
        10000,
        true,
        'T',
      ],
      [
        'coarse when bpPerPx >= threshold (query)',
        true,
        50000,
        10000,
        true,
        'Q',
      ],
      [
        'fine even at high zoom when no coarse tier',
        false,
        1e9,
        10000,
        false,
        't',
      ],
      ['fine when bpPerPx is undefined', false, undefined, 10000, true, 't'],
      ['coarse exactly at the threshold', false, 10000, 10000, true, 'T'],
    ] as const
    const overrideCases = [
      // [name, lodMode, bpPerPx, hasCoarseTier, expected]
      ['fine override beats auto at high zoom', 'fine', 1e9, true, 't'],
      ['coarse override beats auto at low zoom', 'coarse', 1, true, 'T'],
      [
        'coarse override degrades to fine when no coarse tier',
        'coarse',
        1,
        false,
        't',
      ],
    ] as const
    for (const [
      name,
      flip,
      bpPerPx,
      threshold,
      hasCoarseTier,
      expected,
    ] of cases) {
      it(name, () => {
        expect(pickPifPrefix({ flip, bpPerPx, threshold, hasCoarseTier })).toBe(
          expected,
        )
      })
    }
    for (const [
      name,
      lodMode,
      bpPerPx,
      hasCoarseTier,
      expected,
    ] of overrideCases) {
      it(name, () => {
        expect(
          pickPifPrefix({
            flip: false,
            bpPerPx,
            threshold: 10000,
            hasCoarseTier,
            lodMode,
          }),
        ).toBe(expected)
      })
    }

    it('uses fine tier when fixture has no T/Q tier even at very high bpPerPx', async () => {
      // Locks in the integration behavior the unit-test asserts: feeding a
      // huge bpPerPx into an adapter pointed at a fine-only fixture must
      // still return features, not silently degrade to zero.
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
            { bpPerPx: 1e9 },
          )
          .pipe(toArray()),
      )
      expect(features.length).toBe(1)
    })
  })

  describe('coarse tier integration', () => {
    it('serves fine-tier features (with CIGAR) when zoomed in', async () => {
      const adapter = makeAdapter(pifInsCoarsePath, ['volvox_ins', 'volvox'])
      const features = await firstValueFrom(
        adapter
          .getFeatures(
            { refName: 'ctgA', start: 0, end: 60000, assemblyName: 'volvox' },
            { bpPerPx: 1 },
          )
          .pipe(toArray()),
      )
      expect(features.length).toBe(1)
      expect(features[0]!.get('CIGAR')).toBe('31198M4800I18803M')
    })

    it('serves coarse-tier features (no CIGAR) when zoomed out past threshold', async () => {
      const adapter = makeAdapter(pifInsCoarsePath, ['volvox_ins', 'volvox'])
      const features = await firstValueFrom(
        adapter
          .getFeatures(
            { refName: 'ctgA', start: 0, end: 60000, assemblyName: 'volvox' },
            { bpPerPx: 50000 },
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
