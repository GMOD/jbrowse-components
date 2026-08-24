import {
  ConfigurationReference,
  ConfigurationSchema,
  getConf,
} from '@jbrowse/core/configuration'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { types } from '@jbrowse/mobx-state-tree'
import {
  createCanvas2DBackend,
  createRenderingBackend,
} from '@jbrowse/render-core/createRenderingBackend'
import { installUpload } from '@jbrowse/render-core/installUpload'
import {
  Canvas2DPerRegionRenderingBackend,
  GpuPerRegionRenderingBackend,
} from '@jbrowse/render-core/perRegionRenderingBackend'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'
import { observer } from 'mobx-react'

import DisplayChrome from './DisplayChrome.tsx'
import MultiRegionDisplayMixin, {
  fetchEachRegion,
} from './MultiRegionDisplayMixin.ts'
import TrackHeightMixin from './TrackHeightMixin.tsx'
import baseLinearDisplayConfigSchema from './configSchema.ts'
import { markGpu, markPaint } from './marks.ts'
import { renderDisplaySvg } from './renderDisplaySvg.tsx'

import type { Mark } from './marks.ts'
import type { LgvSvgBodyProps, LgvSvgExportable } from './renderDisplaySvg.tsx'
import type { ExportSvgDisplayOptions } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ConfigSlotDefinition } from '@jbrowse/core/configuration/configurationSlot'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { StatusCallback } from '@jbrowse/core/util/progress'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal } from '@jbrowse/render-core/hal'
import type { InstancePass } from '@jbrowse/render-core/instancePass'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { ShaderModule } from '@jbrowse/render-core/slangPass'

/**
 * What a setting invalidates when it changes: the worker fetch, the
 * main-thread encode, or only the next frame. The factory derives the RPC
 * cache key from the `fetch` set and the render state from all of them, so a
 * display never spells `rpcProps` / `gpuProps` / `renderState` by hand and
 * cannot put a fetch result in a cache key.
 */
export type ParamAffects = 'fetch' | 'encode' | 'frame'

export type ParamDefinition = ConfigSlotDefinition & { affects: ParamAffects }

export type ParamSchema = Record<string, ParamDefinition>

export type ParamValues<P extends ParamSchema> = {
  [K in keyof P]: P[K]['defaultValue']
}

type KeysAffecting<P extends ParamSchema, A extends ParamAffects> = {
  [K in keyof P]: P[K]['affects'] extends A ? K : never
}[keyof P]

export type FetchParams<P extends ParamSchema> = Pick<
  ParamValues<P>,
  KeysAffecting<P, 'fetch'>
>

/** What the worker `data` function is handed for one region. */
export interface DataContext<P extends ParamSchema> {
  adapter: BaseFeatureDataAdapter
  region: Region
  params: FetchParams<P>
  stopToken: StopToken | undefined
  statusCallback: StatusCallback
}

/** What every paint reads: the canvas box and every setting, resolved. */
export interface DisplayRenderState<P extends ParamSchema> {
  canvasWidth: number
  canvasHeight: number
  params: ParamValues<P>
}

export type Paint<Payload, P extends ParamSchema> = (
  ctx: Ctx2D,
  regions: ReadonlyMap<number, Payload>,
  blocks: RenderBlock[],
  state: DisplayRenderState<P>,
) => void

/**
 * The GPU accelerator: a generated shader module, the passes packed from one
 * region's payload, and the uniforms one clipped block draws with. The
 * factory owns the renderer around it, so a display writes no backend class.
 */
export interface GpuSpec<Payload, P extends ParamSchema, Uniforms> {
  shader: ShaderModule & {
    UNIFORMS_SIZE_BYTES: number
    writeUniforms: (buf: ArrayBuffer, uniforms: Uniforms) => void
  }
  passes: InstancePass<Payload>[]
  uniforms: (
    block: RenderBlock,
    clip: BlockClipResult,
    region: Payload,
    state: DisplayRenderState<P>,
  ) => Uniforms
}

// #region drawing
/**
 * How the display draws: a `mark` (a shape plus its channels, from which the
 * GPU pass, the Canvas2D painter and the SVG export all derive), or a `paint`
 * of your own with an optional `gpu` block beside it.
 */
export type Drawing<Payload, P extends ParamSchema, Uniforms> =
  | { mark: Mark<Payload, P>; paint?: never; gpu?: never }
  | {
      paint: Paint<Payload, P>
      gpu?: GpuSpec<Payload, P, Uniforms>
      mark?: never
    }
// #endregion

export type DisplaySpec<
  Payload extends object,
  P extends ParamSchema,
  Uniforms,
> = {
  name: string
  displayName?: string
  trackType: string
  params: P
  /** Runs in the worker, once per region. Positions come back as absolute bp. */
  data: (ctx: DataContext<P>) => Promise<Payload>
} & Drawing<Payload, P, Uniforms>

interface DataArgs<P extends ParamSchema> extends RpcCallContext {
  sessionId: string
  adapterConfig: Record<string, unknown>
  region: Region
  params: FetchParams<P>
}

function slotsOf(schema: ParamSchema) {
  return Object.fromEntries(
    Object.entries(schema).map(([key, { affects: _affects, ...slot }]) => [
      key,
      slot,
    ]),
  )
}

function readParams<P extends ParamSchema>(
  self: Parameters<typeof getConf>[0],
  schema: P,
  affecting?: ParamAffects,
) {
  const out: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(schema)) {
    if (affecting === undefined || def.affects === affecting) {
      out[key] = getConf(self, key)
    }
  }
  return out as ParamValues<P>
}

/**
 * A track type in one call. The spec is the four things a display genuinely
 * decides — its settings, its worker fetch, how it paints, and optionally how
 * the GPU draws it — and the factory composes the display layer around them:
 * the config schema, the per-region fetch foundation, the upload lifecycle,
 * the chrome, the RPC method, and SVG export. Register with `install(pm)`
 * from the plugin's own `install`; it runs on the main thread and in the
 * worker alike, which is what puts `data` where the adapter is.
 */
export function defineDisplay<
  Payload extends object,
  P extends ParamSchema,
  Uniforms,
>(spec: DisplaySpec<Payload, P, Uniforms>) {
  const { name, trackType, params, data } = spec
  const paint = spec.mark ? markPaint(spec.mark) : spec.paint
  const methodName = `${name}Data`
  const configSchema = ConfigurationSchema(name, slotsOf(params), {
    baseConfiguration: baseLinearDisplayConfigSchema,
    explicitlyTyped: true,
  })

  type State = DisplayRenderState<P>
  type Backend = PerRegionRenderingBackend<Payload, State>

  class DataMethod extends RpcMethodType {
    name = methodName

    async execute(serializedArgs: unknown) {
      const args = serializedArgs as DataArgs<P>
      const adapter = await getFeatureAdapterOrThrow({
        pluginManager: this.pluginManager,
        sessionId: args.sessionId,
        adapterConfig: args.adapterConfig,
      })
      return data({
        adapter,
        region: args.region,
        params: args.params,
        stopToken: args.stopToken,
        statusCallback: args.statusCallback ?? (() => {}),
      })
    }
  }

  class Canvas2DRenderer extends Canvas2DPerRegionRenderingBackend<
    Payload,
    State
  > {
    protected draw(
      blocks: RenderBlock[],
      regions: ReadonlyMap<number, Payload>,
      state: State,
    ) {
      paint(this.ctx, regions, blocks, state)
    }
  }

  function gpuRenderer<U>(g: GpuSpec<Payload, P, U>) {
    return class GpuRenderer extends GpuPerRegionRenderingBackend<
      Payload,
      State
    > {
      protected regionPasses = g.passes

      constructor(hal: GpuHal) {
        super(hal, g.shader.UNIFORMS_SIZE_BYTES)
      }

      protected drawRegion(
        block: RenderBlock,
        clip: BlockClipResult,
        region: Payload,
        state: State,
      ) {
        g.shader.writeUniforms(
          this.uniformData,
          g.uniforms(block, clip, region, state),
        )
        this.hal.writeUniforms(this.uniformData)
        for (const pass of g.passes) {
          this.hal.drawPass(pass.id, block.displayedRegionIndex)
        }
      }
    }
  }

  function gpuFactory<U>(g: GpuSpec<Payload, P, U>) {
    const GpuRenderer = gpuRenderer(g)
    return (canvas: HTMLCanvasElement) =>
      createRenderingBackend<Backend>(canvas, {
        passes: g.passes,
        uniformByteSize: g.shader.UNIFORMS_SIZE_BYTES,
        createGpuBackend: hal => new GpuRenderer(hal),
        createCanvas2DBackend: c => new Canvas2DRenderer(c),
      })
  }

  const factory = spec.mark
    ? gpuFactory(markGpu(spec.mark))
    : spec.gpu
      ? gpuFactory(spec.gpu)
      : (canvas: HTMLCanvasElement) =>
          createCanvas2DBackend<Backend>(canvas, c => new Canvas2DRenderer(c))

  interface SvgModel extends LgvSvgExportable {
    id: string
    rpcDataMap: ReadonlyMap<number, Payload>
    renderState: State
  }

  function SvgBody({
    model,
    height,
    canvasWidth,
    renderBlocks,
    opts,
  }: LgvSvgBodyProps<SvgModel>) {
    return (
      <SvgClipRect
        id={`${name}-clip-${svgNodeId(model)}`}
        width={canvasWidth}
        height={height}
      >
        <PaintLayer
          width={canvasWidth}
          height={height}
          opts={opts}
          paint={ctx => {
            paint(ctx, model.rpcDataMap, renderBlocks, {
              ...model.renderState,
              canvasWidth,
              canvasHeight: height,
            })
          }}
        />
      </SvgClipRect>
    )
  }

  const stateModel = types
    .compose(
      name,
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      types.model({
        type: types.literal(name),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      rpcDataMap: regionDataMap<Payload>('rpcDataMap'),
    }))
    .views(self => ({
      get params() {
        return readParams(self, params)
      },
      rpcProps() {
        return { params: readParams(self, params, 'fetch') }
      },
      get renderState(): State {
        return {
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.height,
          params: this.params,
        }
      },
    }))
    .actions(self => ({
      setRpcData(displayedRegionIndex: number, payload: Payload) {
        self.rpcDataMap.set(displayedRegionIndex, payload)
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
      },
    }))
    .actions(self => ({
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        const { adapterConfig } = self
        return fetchEachRegion(self, needed, {
          call: (region, ctx) =>
            ctx.callRpc(methodName, {
              adapterConfig,
              region,
              ...self.rpcProps(),
            }) as Promise<Payload>,
          onResult: (displayedRegionIndex, payload) => {
            self.setRpcData(displayedRegionIndex, payload)
          },
        })
      },
      startRenderingBackend(backend: Backend) {
        installUpload(self, backend, {
          cells: () => self.rpcDataMap,
          render: (b, regions) =>
            regions.size === 0
              ? false
              : b.renderBlocks(self.renderBlocks, regions, self.renderState),
        })
      },
      renderSvg(opts?: ExportSvgDisplayOptions) {
        return renderDisplaySvg(self, opts, SvgBody)
      },
    }))

  type Model = Instance<typeof stateModel>

  const ReactComponent = observer(function DisplayComponent({
    model,
  }: {
    model: Model
  }) {
    return (
      <DisplayChrome
        model={model}
        factory={factory}
        testid={`${name}-display`}
        style={{ width: '100%', height: model.height }}
      >
        {({ canvasRef }) => (
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        )}
      </DisplayChrome>
    )
  })

  return {
    name,
    configSchema,
    stateModel,
    ReactComponent,
    install(pluginManager: PluginManager) {
      pluginManager.addDisplayType(
        () =>
          new DisplayType({
            name,
            displayName: spec.displayName,
            configSchema,
            stateModel,
            trackType,
            viewType: 'LinearGenomeView',
            ReactComponent,
          }),
      )
      pluginManager.addRpcMethod(() => new DataMethod(pluginManager))
    },
  }
}
