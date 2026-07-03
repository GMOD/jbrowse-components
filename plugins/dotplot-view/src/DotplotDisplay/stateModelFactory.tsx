import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'

import { renderSvg } from './renderSvg.tsx'

import type { DotplotGeometryData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRpcData } from './types.ts'
import type { ExportSvgOptions } from '../DotplotView/model.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { SyntenyColorBy } from '@jbrowse/synteny-core'
import type { ThemeOptions } from '@mui/material'

/**
 * #stateModel DotplotDisplay
 * #category display
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'DotplotDisplay',
      BaseDisplay,
      types
        .model({
          /**
           * #property
           */
          type: types.literal('DotplotDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
          /**
           * #property
           * color by setting that overrides the config setting
           */
          colorBy: types.optional(types.string, 'default'),
          /**
           * #property
           */
          alpha: types.optional(types.number, 1),
          /**
           * #property
           */
          minAlignmentLength: types.optional(types.number, 0),
        })
        .volatile(() => ({
          /**
           * #volatile
           * RPC-computed feature data
           */
          rpcData: undefined as DotplotRpcData | undefined,
          /**
           * #volatile
           * GPU-instance geometry produced from featPositions, self-
           * describing via embedded bpPerPx. The containing DotplotView
           * aggregates one of these per display and uploads them to the
           * shared backend keyed by track index.
           */
          geometry: undefined as DotplotGeometryData | undefined,
          fetchStopToken: undefined as StopToken | undefined,
          fetchWarnings: [] as { message: string; effect: string }[],
          // Set once at view load by a refName-comparison check, independent of
          // the per-render fetch. See afterAttach.
          assembliesSwapped: false,
        })),
    )
    .views(self => ({
      get isLoading() {
        return self.fetchStopToken !== undefined && !self.rpcData
      },
      get isRefetching() {
        return self.fetchStopToken !== undefined && !!self.rpcData
      },
      /**
       * #getter
       * Per-render fetch warnings, plus the load-time reversed-assembly hint.
       */
      get warnings() {
        return self.assembliesSwapped
          ? [
              ...self.fetchWarnings,
              {
                message: 'The assemblies appear to be in the wrong order',
                effect:
                  'The chromosome names in the file match the opposite axis. Try switching the X and Y assemblies in the dotplot import form.',
              },
            ]
          : self.fetchWarnings
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      renderSvg(opts: ExportSvgOptions & { theme?: ThemeOptions }) {
        return renderSvg(self, opts)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLoading(stopToken: StopToken) {
        self.fetchStopToken = stopToken
        self.error = undefined
      },
      /**
       * #action
       */
      setRpcData(data: DotplotRpcData) {
        self.rpcData = data
        self.fetchStopToken = undefined
        self.statusMessage = undefined
        self.statusProgress = undefined
      },
      setWarnings(w: { message: string; effect: string }[]) {
        self.fetchWarnings = w
      },
      setAssembliesSwapped(arg: boolean) {
        self.assembliesSwapped = arg
      },
      setGeometry(data: DotplotGeometryData | undefined) {
        self.geometry = data
      },
      /**
       * #action
       */
      setError(error: unknown) {
        console.error(error)
        self.error = error
        self.fetchStopToken = undefined
        self.statusMessage = undefined
        self.statusProgress = undefined
      },
      /**
       * #action
       */
      setAlpha(value: number) {
        self.alpha = value
      },
      /**
       * #action
       */
      setMinAlignmentLength(value: number) {
        self.minAlignmentLength = value
      },
      /**
       * #action
       */
      setColorBy(value: SyntenyColorBy) {
        self.colorBy = value
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
    }))
}

export type DotplotDisplayModel = Instance<ReturnType<typeof stateModelFactory>>
