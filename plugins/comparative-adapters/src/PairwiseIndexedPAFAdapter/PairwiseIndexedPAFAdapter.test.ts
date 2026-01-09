import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './PairwiseIndexedPAFAdapter.ts'
import MyConfigSchema from './configSchema.ts'

function makeAdapter(
  pifFile: string,
  assemblyNames: [string, string],
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

      const mate = feature.get('mate')
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

      const mate = feature.get('mate')
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

      expect(qFeature.get('start')).toBe(tFeature.get('mate').start)
      expect(qFeature.get('end')).toBe(tFeature.get('mate').end)
      expect(qFeature.get('mate').start).toBe(tFeature.get('start'))
      expect(qFeature.get('mate').end).toBe(tFeature.get('end'))
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
      expect(feature.get('start')).toBe(0)
      expect(feature.get('end')).toBe(45141)
      expect(feature.get('mate').start).toBe(0)
      expect(feature.get('mate').end).toBe(50001)
    })
  })

  describe('getRefNames', () => {
    it('returns query reference names for query assembly', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])
      const refNames = await adapter.getRefNames({
        regions: [{ assemblyName: 'volvox_ins' }],
      })
      expect(refNames).toContain('ctgA')
    })

    it('returns target reference names for target assembly', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])
      const refNames = await adapter.getRefNames({
        regions: [{ assemblyName: 'volvox' }],
      })
      expect(refNames).toContain('ctgA')
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
