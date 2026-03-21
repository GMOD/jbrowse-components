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
const pifMultiPath =
  require.resolve('../../../../test_data/volvox/volvox_multi.pif.gz')

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
        regions: [
          { assemblyName: 'volvox_ins', refName: '', start: 0, end: 0 },
        ],
      })
      expect(refNames).toContain('ctgA')
    })

    it('returns target reference names for target assembly', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])
      const refNames = await adapter.getRefNames({
        regions: [{ assemblyName: 'volvox', refName: '', start: 0, end: 0 }],
      })
      expect(refNames).toContain('ctgA')
    })
  })

  describe('getPairInfo', () => {
    it('returns pairCount=1 for single-pair PIF', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])
      const pairInfo = await adapter.getPairInfo()
      expect(pairInfo.pairCount).toBe(1)
      expect(pairInfo.pairs.size).toBe(0)
    })
  })

  describe('getMultiPairFeatures', () => {
    it('returns empty results for single-pair PIF (no pairs header)', async () => {
      const adapter = makeAdapter(pifInsPath, ['volvox_ins', 'volvox'])
      const result = await adapter.getMultiPairFeatures({
        refName: 'ctgA',
        start: 0,
        end: 60000,
        assemblyName: 'volvox',
      })
      expect(result.genomeNames).toEqual([])
      expect(result.genomeRows.size).toBe(0)
    })
  })

  describe('multi-pair PIF', () => {
    it('getPairInfo returns pair metadata', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])
      const pairInfo = await adapter.getPairInfo()
      expect(pairInfo.pairCount).toBe(2)
      expect(pairInfo.pairs.size).toBe(2)
      expect(pairInfo.pairs.get(0)).toEqual(['volvox_ins', 'volvox'])
      expect(pairInfo.pairs.get(1)).toEqual(['volvox_del', 'volvox'])
    })

    it('getMultiPairFeatures returns features for both pairs', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])
      const result = await adapter.getMultiPairFeatures({
        refName: 'ctgA',
        start: 0,
        end: 60000,
        assemblyName: 'volvox',
      })

      expect(result.genomeNames).toEqual(['volvox_ins', 'volvox_del'])
      expect(result.genomeRows.size).toBe(2)

      const insFeatures = result.genomeRows.get('volvox_ins')!
      expect(insFeatures.length).toBe(1)
      expect(insFeatures[0]!.queryGenome).toBe('volvox_ins')
      expect(insFeatures[0]!.start).toBe(0)
      expect(insFeatures[0]!.end).toBe(50001)
      expect(insFeatures[0]!.mateRefName).toBe('ctgA')

      const delFeatures = result.genomeRows.get('volvox_del')!
      expect(delFeatures.length).toBe(1)
      expect(delFeatures[0]!.queryGenome).toBe('volvox_del')
      expect(delFeatures[0]!.start).toBe(0)
      expect(delFeatures[0]!.end).toBe(50001)
    })

    it('getMultiPairFeatures includes syriType', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])
      const result = await adapter.getMultiPairFeatures({
        refName: 'ctgA',
        start: 0,
        end: 60000,
        assemblyName: 'volvox',
      })

      const insFeatures = result.genomeRows.get('volvox_ins')!
      expect(insFeatures[0]!.syriType).toBe('SYN')

      const delFeatures = result.genomeRows.get('volvox_del')!
      expect(delFeatures[0]!.syriType).toBe('SYN')
    })

    it('getMultiPairFeatures returns empty for non-overlapping region', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])
      const result = await adapter.getMultiPairFeatures({
        refName: 'ctgA',
        start: 100000,
        end: 200000,
        assemblyName: 'volvox',
      })

      expect(result.genomeNames).toEqual(['volvox_ins', 'volvox_del'])
      expect(result.genomeRows.get('volvox_ins')!.length).toBe(0)
      expect(result.genomeRows.get('volvox_del')!.length).toBe(0)
    })

    it('getFeatures works with multi-pair PIF for individual pair', async () => {
      const adapter = makeAdapter(pifMultiPath, ['volvox_ins', 'volvox'])
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

      expect(features.length).toBe(1)
      expect(features[0]!.get('start')).toBe(0)
      expect(features[0]!.get('end')).toBe(50001)
    })

    it('getMultiPairFeatures mate coordinates match getFeatures mate coordinates', async () => {
      const multiAdapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])
      const multiResult = await multiAdapter.getMultiPairFeatures({
        refName: 'ctgA',
        start: 0,
        end: 60000,
        assemblyName: 'volvox',
      })

      // Compare with single-pair adapter results
      const singleInsAdapter = makeAdapter(pifInsPath, [
        'volvox_ins',
        'volvox',
      ])
      const singleInsFeatures = await firstValueFrom(
        singleInsAdapter
          .getFeatures({
            refName: 'ctgA',
            start: 0,
            end: 60000,
            assemblyName: 'volvox',
          })
          .pipe(toArray()),
      )

      const multiInsFeatures = multiResult.genomeRows.get('volvox_ins')!
      expect(multiInsFeatures[0]!.mateStart).toBe(
        singleInsFeatures[0]!.get('mate').start,
      )
      expect(multiInsFeatures[0]!.mateEnd).toBe(
        singleInsFeatures[0]!.get('mate').end,
      )
    })

    it('getMultiPairFeatures identity is computed correctly', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])
      const result = await adapter.getMultiPairFeatures({
        refName: 'ctgA',
        start: 0,
        end: 60000,
        assemblyName: 'volvox',
      })

      const insFeatures = result.genomeRows.get('volvox_ins')!
      expect(insFeatures[0]!.identity).toBeGreaterThan(0)
      expect(insFeatures[0]!.identity).toBeLessThanOrEqual(1)

      const delFeatures = result.genomeRows.get('volvox_del')!
      expect(delFeatures[0]!.identity).toBeGreaterThan(0)
      expect(delFeatures[0]!.identity).toBeLessThanOrEqual(1)
    })

    it('getMultiPairFeatures strand is correct', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])
      const result = await adapter.getMultiPairFeatures({
        refName: 'ctgA',
        start: 0,
        end: 60000,
        assemblyName: 'volvox',
      })

      // Both alignments are forward strand
      const insFeatures = result.genomeRows.get('volvox_ins')!
      expect(insFeatures[0]!.strand).toBe(1)

      const delFeatures = result.genomeRows.get('volvox_del')!
      expect(delFeatures[0]!.strand).toBe(1)
    })

    it('getMultiPairFeatures featureId is unique per feature', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])
      const result = await adapter.getMultiPairFeatures({
        refName: 'ctgA',
        start: 0,
        end: 60000,
        assemblyName: 'volvox',
      })

      const allFeatureIds = new Set<string>()
      for (const features of result.genomeRows.values()) {
        for (const f of features) {
          expect(allFeatureIds.has(f.featureId)).toBe(false)
          allFeatureIds.add(f.featureId)
        }
      }
    })

    it('getMultiPairFeatures partial region overlap works', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])

      // Query only the middle portion of the alignment
      const result = await adapter.getMultiPairFeatures({
        refName: 'ctgA',
        start: 20000,
        end: 30000,
        assemblyName: 'volvox',
      })

      // The alignments span 0-50001, so they overlap 20000-30000
      const insFeatures = result.genomeRows.get('volvox_ins')!
      expect(insFeatures.length).toBe(1)
      expect(insFeatures[0]!.start).toBe(0)
      expect(insFeatures[0]!.end).toBe(50001)

      const delFeatures = result.genomeRows.get('volvox_del')!
      expect(delFeatures.length).toBe(1)
    })

    it('getMultiPairFeatures returns empty for nonexistent refName', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])
      const result = await adapter.getMultiPairFeatures({
        refName: 'nonexistent',
        start: 0,
        end: 60000,
        assemblyName: 'volvox',
      })

      expect(result.genomeNames).toEqual(['volvox_ins', 'volvox_del'])
      expect(result.genomeRows.get('volvox_ins')!.length).toBe(0)
      expect(result.genomeRows.get('volvox_del')!.length).toBe(0)
    })

    it('getHeader includes multi-pair metadata', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])
      const header = await adapter.getHeader()

      expect(header).toContain('pairs=2')
      expect(header).toContain('pair0=volvox_ins,volvox')
      expect(header).toContain('pair1=volvox_del,volvox')
      expect(header).toContain('splitThreshold=')
      expect(header).toContain('mergeGap=')
    })

    it('getRefNames works with multi-pair PIF', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])

      const queryRefNames = await adapter.getRefNames({
        regions: [
          { assemblyName: 'volvox_ins', refName: '', start: 0, end: 0 },
        ],
      })
      expect(queryRefNames).toContain('ctgA')

      const targetRefNames = await adapter.getRefNames({
        regions: [
          { assemblyName: 'volvox', refName: '', start: 0, end: 0 },
        ],
      })
      expect(targetRefNames).toContain('ctgA')
    })

    it('structural tier (xt) features work with multi-pair', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])

      // Use a very high bpPerPx to trigger structural tier
      const result = await adapter.getMultiPairFeatures(
        {
          refName: 'ctgA',
          start: 0,
          end: 60000,
          assemblyName: 'volvox',
        },
        { bpPerPx: 1000000 },
      )

      expect(result.genomeNames).toEqual(['volvox_ins', 'volvox_del'])

      // Structural tier should still return features
      const insFeatures = result.genomeRows.get('volvox_ins')!
      expect(insFeatures.length).toBeGreaterThanOrEqual(1)
      expect(insFeatures[0]!.syriType).toBe('SYN')

      const delFeatures = result.genomeRows.get('volvox_del')!
      expect(delFeatures.length).toBeGreaterThanOrEqual(1)
    })

    it('summary tier (st) features work with multi-pair', async () => {
      const adapter = makeAdapter(pifMultiPath, [
        'volvox_ins',
        'volvox',
        'volvox_del',
      ] as unknown as [string, string])

      // Use bpPerPx just above splitThreshold to trigger summary tier
      const pairInfo = await adapter.getPairInfo()
      const bpPerPx = (pairInfo.splitThreshold ?? 10000) + 1

      const result = await adapter.getMultiPairFeatures(
        {
          refName: 'ctgA',
          start: 0,
          end: 60000,
          assemblyName: 'volvox',
        },
        { bpPerPx },
      )

      expect(result.genomeNames).toEqual(['volvox_ins', 'volvox_del'])
      const insFeatures = result.genomeRows.get('volvox_ins')!
      expect(insFeatures.length).toBeGreaterThanOrEqual(1)
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
