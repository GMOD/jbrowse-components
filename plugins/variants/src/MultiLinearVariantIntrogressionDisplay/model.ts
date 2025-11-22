import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { cast, types } from 'mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from 'mobx-state-tree'

interface PopulationAssignment {
  P1: string[]
  P2: string[]
  P3: string[]
  outgroup: string[]
}

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'MultiLinearVariantIntrogressionDisplay',
      MultiVariantBaseModelF(configSchema),
      types.model({
        type: types.literal('MultiLinearVariantIntrogressionDisplay'),
        configuration: ConfigurationReference(configSchema),
        populations: types.optional(
          types.frozen<PopulationAssignment>(),
          {
            P1: [],
            P2: [],
            P3: [],
            outgroup: [],
          },
        ),
        autoAssignFromClustering: types.optional(types.boolean, false),
        windowSize: types.optional(types.number, 50000),
        stepSize: types.optional(types.number, 10000),
      }),
    )
    .volatile(() => ({
      introgressionData: undefined as
        | {
            positions: number[]
            refNames: string[]
            abbaCount: number
            babaCount: number
            dStatistic: number
            zScore: number
            pairwiseD: {
              p1p2: number[]
              p1p3: number[]
              p2p3: number[]
            }
          }
        | undefined,
      introgressionLoading: false,
    }))
    .views(self => ({
      get rendererTypeName() {
        return 'MultiLinearVariantIntrogressionRenderer'
      },
      get adapterConfig() {
        const subConf = getConf(self, ['adapter'])
        return subConf
      },
      get assignedSamples() {
        const { P1, P2, P3, outgroup } = self.populations
        return new Set([...P1, ...P2, ...P3, ...outgroup])
      },
      get unassignedSamples() {
        const assigned = this.assignedSamples
        return self.layout.filter(s => !assigned.has(s.name))
      },
      get isPopulationConfigured() {
        const { P1, P2, P3, outgroup } = self.populations
        return (
          P1.length > 0 &&
          P2.length > 0 &&
          P3.length > 0 &&
          outgroup.length > 0
        )
      },
    }))
    .actions(self => ({
      setPopulations(populations: PopulationAssignment) {
        self.populations = cast(populations)
      },
      setAutoAssignFromClustering(value: boolean) {
        self.autoAssignFromClustering = value
      },
      setWindowSize(size: number) {
        self.windowSize = size
      },
      setStepSize(size: number) {
        self.stepSize = size
      },
      setIntrogressionData(data: typeof self.introgressionData) {
        self.introgressionData = data
      },
      setIntrogressionLoading(loading: boolean) {
        self.introgressionLoading = loading
      },
      autoAssignPopulationsFromTree() {
        if (!self.root) {
          return
        }

        const leaves = self.root.leaves()
        const totalLeaves = leaves.length

        if (totalLeaves < 4) {
          return
        }

        const outgroupSize = Math.max(1, Math.floor(totalLeaves * 0.15))
        const remainingSize = totalLeaves - outgroupSize
        const p1Size = Math.floor(remainingSize / 3)
        const p2Size = Math.floor(remainingSize / 3)
        const p3Size = remainingSize - p1Size - p2Size

        const outgroup = leaves.slice(0, outgroupSize).map(l => l.data.name)
        const P1 = leaves
          .slice(outgroupSize, outgroupSize + p1Size)
          .map(l => l.data.name)
        const P2 = leaves
          .slice(outgroupSize + p1Size, outgroupSize + p1Size + p2Size)
          .map(l => l.data.name)
        const P3 = leaves
          .slice(outgroupSize + p1Size + p2Size)
          .map(l => l.data.name)

        this.setPopulations({ P1, P2, P3, outgroup })
      },
      async calculateIntrogression() {
        if (!self.isPopulationConfigured) {
          return
        }

        this.setIntrogressionLoading(true)

        try {
          const session = getSession(self)
          const { rpcManager } = session
          const adapterConfig = self.adapterConfig

          const result = await rpcManager.call(
            self.id,
            'MultiVariantIntrogressionMatrix',
            {
              adapterConfig,
              regions: self.dynamicBlocks.contentBlocks,
              sessionId: 'default',
              populations: self.populations,
            },
          )

          this.setIntrogressionData(result)
        } catch (error) {
          console.error('Failed to calculate introgression:', error)
          session.notifyError(`${error}`, error)
        } finally {
          this.setIntrogressionLoading(false)
        }
      },
    }))
    .views(self => ({
      get renderProps() {
        return {
          ...self.composedRenderProps,
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          config: self.configuration,
          introgressionData: self.introgressionData,
          populations: self.populations,
        }
      },
    }))
}

export type MultiLinearVariantIntrogressionDisplayStateModel =
  ReturnType<typeof stateModelFactory>
export type MultiLinearVariantIntrogressionDisplayModel =
  Instance<MultiLinearVariantIntrogressionDisplayStateModel>
