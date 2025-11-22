import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { checkAbortSignal } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { getGenotypeMatrix } from './getGenotypeMatrix'

interface PopulationConfig {
  P1: string[]
  P2: string[]
  P3: string[]
  outgroup: string[]
}

interface IntrogressionResult {
  positions: number[]
  refNames: string[]
  abbaCount: number
  babaCoun: number
  dStatistic: number
  zScore: number
  pairwiseD: {
    p1p2: number[]
    p1p3: number[]
    p2p3: number[]
  }
}

function calculateABBABABA(
  features: Feature[],
  samples: string[],
  populations: PopulationConfig,
) {
  const { P1, P2, P3, outgroup } = populations

  let abbaCount = 0
  let babaCount = 0
  const positions: number[] = []
  const refNames: string[] = []

  for (const feature of features) {
    const genotypes = feature.get('genotypes') as Record<string, string> | undefined
    if (!genotypes) {
      continue
    }

    const p1Geno = P1.map(s => genotypes[s])
    const p2Geno = P2.map(s => genotypes[s])
    const p3Geno = P3.map(s => genotypes[s])
    const outGeno = outgroup.map(s => genotypes[s])

    const p1Alt = getAlleleFrequency(p1Geno)
    const p2Alt = getAlleleFrequency(p2Geno)
    const p3Alt = getAlleleFrequency(p3Geno)
    const outAlt = getAlleleFrequency(outGeno)

    if (
      p1Alt === null ||
      p2Alt === null ||
      p3Alt === null ||
      outAlt === null
    ) {
      continue
    }

    const abba = (1 - p1Alt) * p2Alt * p3Alt * (1 - outAlt)
    const baba = p1Alt * (1 - p2Alt) * p3Alt * (1 - outAlt)

    if (abba > 0 || baba > 0) {
      positions.push(feature.get('start'))
      refNames.push(feature.get('refName'))
      abbaCount += abba
      babaCount += baba
    }
  }

  const dStatistic =
    abbaCount + babaCount > 0 ? (abbaCount - babaCount) / (abbaCount + babaCount) : 0

  const variance =
    features.length > 0
      ? ((abbaCount + babaCount) * (1 - Math.abs(dStatistic))) /
        features.length
      : 0
  const zScore = variance > 0 ? dStatistic / Math.sqrt(variance) : 0

  return {
    positions,
    refNames,
    abbaCount,
    babaCount,
    dStatistic,
    zScore,
  }
}

function getAlleleFrequency(genotypes: (string | undefined)[]): number | null {
  let altCount = 0
  let totalAlleles = 0

  for (const geno of genotypes) {
    if (!geno || geno === '.' || geno === './.' || geno === '.|.') {
      continue
    }

    const alleles = geno.split(/[\/|]/).filter(a => a !== '.')
    for (const allele of alleles) {
      const alleleNum = Number.parseInt(allele, 10)
      if (!Number.isNaN(alleleNum)) {
        if (alleleNum > 0) {
          altCount++
        }
        totalAlleles++
      }
    }
  }

  return totalAlleles > 0 ? altCount / totalAlleles : null
}

function calculatePairwiseD(
  features: Feature[],
  samples: string[],
  populations: PopulationConfig,
) {
  const { P1, P2, P3 } = populations

  const p1p2: number[] = []
  const p1p3: number[] = []
  const p2p3: number[] = []

  for (const feature of features) {
    const genotypes = feature.get('genotypes') as Record<string, string> | undefined
    if (!genotypes) {
      continue
    }

    const p1Geno = P1.map(s => genotypes[s])
    const p2Geno = P2.map(s => genotypes[s])
    const p3Geno = P3.map(s => genotypes[s])

    const p1Alt = getAlleleFrequency(p1Geno)
    const p2Alt = getAlleleFrequency(p2Geno)
    const p3Alt = getAlleleFrequency(p3Geno)

    if (p1Alt !== null && p2Alt !== null) {
      p1p2.push(Math.abs(p1Alt - p2Alt))
    }
    if (p1Alt !== null && p3Alt !== null) {
      p1p3.push(Math.abs(p1Alt - p3Alt))
    }
    if (p2Alt !== null && p3Alt !== null) {
      p2p3.push(Math.abs(p2Alt - p3Alt))
    }
  }

  return { p1p2, p1p3, p2p3 }
}

export class MultiVariantIntrogressionMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantIntrogressionMatrix'

  async deserializeReturn(
    result: IntrogressionResult,
    args: unknown,
    rpcDriverClassName: string,
  ) {
    return result
  }

  async execute(
    args: {
      adapterConfig: unknown
      signal?: RemoteAbortSignal
      sessionId: string
      headers?: Record<string, string>
      regions: Region[]
      bpPerPx: number
      populations: PopulationConfig
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const {
      adapterConfig,
      sessionId,
      regions,
      signal,
      populations,
    } = deserializedArgs

    const dataAdapter = (await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )) as BaseFeatureDataAdapter

    if (!dataAdapter) {
      throw new Error('Failed to get adapter')
    }

    const renamedRegions = renameRegionsIfNeeded(dataAdapter, regions)
    const features: Feature[] = []
    const samples: string[] = []

    for (const region of renamedRegions) {
      await checkAbortSignal(signal)
      const feats = dataAdapter.getFeaturesInRegion(region, {
        signal,
      })

      for await (const feature of feats) {
        await checkAbortSignal(signal)
        features.push(feature)

        if (samples.length === 0) {
          const genotypes = feature.get('genotypes') as
            | Record<string, string>
            | undefined
          if (genotypes) {
            samples.push(...Object.keys(genotypes))
          }
        }
      }
    }

    const abbababaResult = calculateABBABABA(features, samples, populations)
    const pairwiseD = calculatePairwiseD(features, samples, populations)

    return {
      ...abbababaResult,
      pairwiseD,
    } as IntrogressionResult
  }
}
