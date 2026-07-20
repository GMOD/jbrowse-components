import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { isDataCurrent } from '@jbrowse/synteny-core'

import { dotplotFetchKey } from './fetchKey.ts'
import { renderSvg } from './renderSvg.tsx'

import type {
  DotplotViewModel,
  ExportSvgOptions,
} from '../DotplotView/model.ts'
import type { DotplotGeometryData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRpcData } from './types.ts'
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
          // Signature of the view inputs the current rpcData was fetched for
          // (see fetchKey.ts). Compared against the live inputs in `dataCurrent`
          // to detect data gone stale after a zoom or diagonalize reorder.
          loadedFetchKey: undefined as string | undefined,
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
       * The fetch-input signature (see fetchKey.ts) for the view's current
       * state. Reactive: recomputes when either axis's zoom or displayed-region
       * order/orientation changes.
       */
      get currentFetchKey(): string {
        const view = getContainingView(self) as DotplotViewModel
        return dotplotFetchKey(view.lodMode, view.hview, view.vview)
      },
      /**
       * #getter
       * True when the rendered rpcData was fetched for the view's current
       * inputs. Goes false the instant a zoom or diagonalize reorder changes the
       * axes — before the debounced refetch begins and while stale geometry is
       * still on screen — so the `settled` done-gate can't fire on it. The
       * dotplot analog of LGV's `viewportWithinLoadedData`.
       */
      get dataCurrent(): boolean {
        return isDataCurrent(self.loadedFetchKey, this.currentFetchKey)
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
      /**
       * #getter
       * Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady").
       * Dotplot is non-rectangular (square canvas), so it keeps a bespoke
       * `SVGErrorBox` error UI instead of `SvgChrome`, but still exposes
       * `svgReady` + awaits it via the shared `awaitSvgReady` — no inlined
       * `when()`. No `regionTooLarge` state. Stale-safe via `dataCurrent`: an
       * export fired right after a zoom/diagonalize reorder waits for geometry
       * rebuilt from the fresh fetch instead of exporting the stale plot (the
       * follow-up the synteny gate also now carries).
       */
      get svgReady() {
        return (!!self.geometry && this.dataCurrent) || !!self.error
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
      setRpcData(data: DotplotRpcData, fetchKey: string) {
        self.rpcData = data
        self.loadedFetchKey = fetchKey
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
