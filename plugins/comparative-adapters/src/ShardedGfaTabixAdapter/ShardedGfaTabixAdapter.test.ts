import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

import CombinedAdapter from '../GfaTabixAdapter/GfaTabixAdapter.ts'
import CombinedSchema from '../GfaTabixAdapter/configSchema.ts'

import Adapter from './ShardedGfaTabixAdapter.ts'
import MyConfigSchema from './configSchema.ts'

const BINARY = path.resolve('tools/gfa-to-tabix/target/release/gfa-to-tabix')
const GFA_FILE = path.resolve(
  'test/data/synteny-demo/synthetic/synthetic_4genome.gfa',
)

function runConverter(gfaFile: string, prefix: string, extraArgs: string[] = []) {
  execSync(`"${BINARY}" "${gfaFile}" "${prefix}" ${extraArgs.join(' ')}`, {
    stdio: 'pipe',
    env: { ...process.env, LC_ALL: 'C' },
  })
}

function withShardedData(fn: (prefix: string) => Promise<void>) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sharded-test-'))
  const prefix = path.join(tmpDir, 'test')
  runConverter(GFA_FILE, prefix, ['--sharded'])
  return fn(prefix).finally(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
}

function makeAdapter(prefix: string) {
  return new Adapter(
    MyConfigSchema.create({
      posLocation: {
        localPath: `${prefix}.pos.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      posIndex: {
        location: {
          localPath: `${prefix}.pos.bed.gz.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      segmentsManifestLocation: {
        localPath: `${prefix}.segments.manifest.json`,
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

describe('ShardedGfaTabixAdapter round-trip', () => {
  it('returns features for all genomes from sharded data', async () => {
    await withShardedData(async prefix => {
      const adapter = makeAdapter(prefix)
      const result = await adapter.getMultiPairFeatures({
        refName: 'chr1',
        start: 0,
        end: 100000,
        assemblyName: 'ref#1',
      })

      expect(result.genomeRows.size).toBe(3)
      for (const features of result.genomeRows.values()) {
        expect(features.length).toBeGreaterThan(0)
      }
    })
  })

  it('produces same features as combined adapter', async () => {
    await withShardedData(async shardedPrefix => {
      const tmpDir = path.dirname(shardedPrefix)
      const combinedPrefix = path.join(tmpDir, 'combined')
      runConverter(GFA_FILE, combinedPrefix)

      const combinedAdapter = new CombinedAdapter(
        CombinedSchema.create({
          posLocation: {
            localPath: `${combinedPrefix}.pos.bed.gz`,
            locationType: 'LocalPathLocation',
          },
          posIndex: {
            location: {
              localPath: `${combinedPrefix}.pos.bed.gz.tbi`,
              locationType: 'LocalPathLocation',
            },
          },
          segmentsLocation: {
            localPath: `${combinedPrefix}.segments.gz`,
            locationType: 'LocalPathLocation',
          },
          segmentsGziLocation: {
            localPath: `${combinedPrefix}.segments.gz.gzi`,
            locationType: 'LocalPathLocation',
          },
          segmentsIdxLocation: {
            localPath: `${combinedPrefix}.segments.idx`,
            locationType: 'LocalPathLocation',
          },
        }),
      )

      const shardedAdapter = makeAdapter(shardedPrefix)
      const query = {
        refName: 'chr1',
        start: 0,
        end: 100000,
        assemblyName: 'ref#1',
      }

      const combinedResult = await combinedAdapter.getMultiPairFeatures(query)
      const shardedResult = await shardedAdapter.getMultiPairFeatures(query)

      expect([...shardedResult.genomeRows.keys()].sort()).toEqual(
        [...combinedResult.genomeRows.keys()].sort(),
      )

      for (const [genome, shardedFeatures] of shardedResult.genomeRows) {
        const combinedFeatures = combinedResult.genomeRows.get(genome)!
        expect(shardedFeatures.length).toBe(combinedFeatures.length)

        const sortedS = [...shardedFeatures].sort((a, b) => a.start - b.start)
        const sortedC = [...combinedFeatures].sort((a, b) => a.start - b.start)

        for (let i = 0; i < sortedS.length; i++) {
          expect(sortedS[i]!.start).toBe(sortedC[i]!.start)
          expect(sortedS[i]!.end).toBe(sortedC[i]!.end)
          expect(sortedS[i]!.mateStart).toBe(sortedC[i]!.mateStart)
          expect(sortedS[i]!.mateEnd).toBe(sortedC[i]!.mateEnd)
          expect(sortedS[i]!.strand).toBe(sortedC[i]!.strand)
        }
      }
    })
  })

  it('getChromSizes works from sharded data', async () => {
    await withShardedData(async prefix => {
      const adapter = makeAdapter(prefix)
      const chromSizes = await adapter.getChromSizes()

      expect(chromSizes.size).toBe(4)
      expect(chromSizes.has('ref#1')).toBe(true)
      const refSizes = chromSizes.get('ref#1')!
      expect(refSizes[0]!.refName).toBe('chr1')
      expect(refSizes[0]!.length).toBeGreaterThan(0)
    })
  })

  it('getAssemblyNamesFromHeader works from sharded data', async () => {
    await withShardedData(async prefix => {
      const adapter = makeAdapter(prefix)
      const names = await adapter.getAssemblyNamesFromHeader()
      expect(names.sort()).toEqual(
        ['ref#1', 'sample1#1', 'sample2#1', 'sample3#1'].sort(),
      )
    })
  })
})
