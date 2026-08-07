import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { types } from '@jbrowse/mobx-state-tree'
import { createRegionUploadSync } from '@jbrowse/render-core/regionUploadSync'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'
import { placeVariantRows } from '../shared/placeVariantRows.ts'
import { markersForBlock } from './components/drawVariantInsertionGlyphs.ts'
import { drawnCellHeightPx } from './components/shaders/variant.js.generated.ts'

import type { ShippedRegionData } from '../VariantRPC/executeVariantCellData.ts'
import type { Placed } from '../shared/placeVariantRows.ts'
import type {
  VariantRenderingBackend,
  VariantUploadData,
} from './components/variantRenderingBackendTypes.ts'
import type { LinearMultiSampleVariantDisplayConfigModel } from './configSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearMultiSampleVariantDisplay
 * Multi-sample variant display drawing one genotype row per sample, with a
 * per-cell feature widget on click.
 */
export function stateModelFactory(
  configSchema: LinearMultiSampleVariantDisplayConfigModel,
) {
  return (
    types
      .compose(
        'LinearMultiSampleVariantDisplay',
        MultiSampleVariantBaseModelF(configSchema, 'regular'),
        types.model({
          type: types.literal('LinearMultiSampleVariantDisplay'),
          // Same node the base already holds — the base declares
          // `configuration` off a param typed to the *shared* schema, so a slot
          // this display owns alone (showInsertionGlyphs) would be invisible to
          // `getConf`. Redeclaring here overrides the prop's type with the
          // concrete schema (`types.compose` overrides props, it does not
          // intersect them), so own-slot reads narrow. Runtime value is
          // identical: `configSchema` is this display's schema either way.
          configuration: ConfigurationReference(configSchema),
        }),
      )
      // Remap the old type literal on active (view-level) display instances. The
      // DisplayType `aliases` only covers the track *config*; the view's display
      // union dispatches on the raw `type`, so it needs this rewrite too.
      .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
        snap?.type === 'MultiLinearVariantDisplay'
          ? { ...snap, type: 'LinearMultiSampleVariantDisplay' }
          : snap,
      )
      .views(self => {
        const {
          showSubmenuItems: superShowSubmenuItems,
          rpcProps: superRpcProps,
        } = self

        return {
          get visibleRegions() {
            const view = self.lgv
            return view.visibleRegions
          },
          // Resolved geometry, never undefined. "The view isn't measured yet" is
          // the mixin-wide `canRender` gate, and "no regular-mode payload" falls
          // out of an empty perRegionCellMap — neither is a nullable state.
          get renderState() {
            return {
              canvasWidth: self.canvasWidthPx,
              canvasHeight: self.availableHeight,
              rowHeight: self.effectiveRowHeight,
              scrollTop: self.scrollTop,
            }
          },
          // referenceDrawingMode is a fetch input here and only here:
          // computeVariantCells omits reference cells entirely when it is
          // 'skip', so the shipped payload differs. The matrix keeps it out of
          // rpcProps because it always computes ref cells and greys the
          // background in CSS — listing it there refetched identical bytes
          // whenever PORTABLE_CONFIG_KEYS carried the slot across a
          // display-type switch.
          rpcProps() {
            return {
              ...superRpcProps(),
              referenceDrawingMode: self.referenceDrawingMode,
            }
          },
          showSubmenuItems() {
            return [
              ...superShowSubmenuItems(),
              {
                label: 'Show reference alleles',
                helpText:
                  'When this setting is off, the background is colored solid grey and only ALT alleles are colored on top of it. This makes it easier to see potentially overlapping structural variants',
                type: 'checkbox',
                checked: self.referenceDrawingMode !== 'skip',
                onClick: () => {
                  self.setReferenceDrawingMode(
                    self.referenceDrawingMode === 'skip' ? 'draw' : 'skip',
                  )
                },
              },
            ]
          },
        }
      })
      .views(self => ({
        get prefersOffset() {
          return true
        },
        /**
         * #getter
         * The one walk of `perRegionCellData`, and the point where a fetched
         * cell becomes a *placed* cell. Every regular-mode consumer reads this
         * map, so "does the glyph overlay see the same regions, and the same
         * rows, as the canvas" has a single answer — the placed payload
         * structurally satisfies `VariantUploadData` (GPU/Canvas upload) and
         * `VariantInsertionGlyphData` (overlay), and carries `featureIndexData`
         * for the hit-test index plus `cellWorkerRowIndices` for its lookup.
         *
         * This is the display's "derived region map" in the sense of
         * ARCHITECTURE.md's re-upload-without-refetch pattern: the arrays are
         * freshly allocated per region and never mutated in place, so a row
         * reorder changes each entry's identity, `createRegionUploadSync` sees
         * the change and re-uploads, and no RPC is involved. Rows are the only
         * thing derived here — the worker's numbering is arbitrary and must not
         * reach a painter.
         *
         * A computed returning a plain Map, for the same reason the multi-row
         * display's is: the overlay draws inside an effect, where nothing it
         * reads is tracked, so the read has to happen here for a refetch to
         * repaint. Rebuilding is cheap (typical view shows 1-3 regions); MobX
         * caches the computed so only cellData or a reorder invalidates it.
         */
        get perRegionCellMap() {
          const { cellData, rowRemap } = self
          const out = new Map<number, Placed<ShippedRegionData>>()
          // No rowRemap means no data has landed: an empty map is the same
          // "nothing to draw" every consumer already handles. Never fall back to
          // identity placement — the worker's row order is its own.
          if (cellData?.mode === 'regular' && rowRemap) {
            for (const k in cellData.perRegionCellData) {
              out.set(
                Number(k),
                placeVariantRows(cellData.perRegionCellData[k]!, rowRemap),
              )
            }
          }
          return out
        },
      }))
      // separate block so these see perRegionCellMap
      .views(self => ({
        /**
         * #getter
         * Per-region cell data for the insertion-glyph overlay, or undefined
         * when the slot is off.
         */
        get insertionGlyphRegions() {
          return getConf(self, 'showInsertionGlyphs')
            ? self.perRegionCellMap
            : undefined
        },
        /**
         * #getter
         * Overrides the base's `undefined`: this display draws the markers, so
         * it is the one that puts them in the legend. `getSession(self).palette`
         * rather than a React theme, because this is a model getter — and it is
         * the same `palette.insertion` the on-screen overlay paints with (via
         * `usePalette`), so the swatch cannot drift from the glyph there. The
         * SVG export paints with the *export* theme's palette instead, and
         * passes it to `legendSections` so the swatch follows it too.
         *
         * The condition is `markersForBlock` — the painter's own test, on the
         * painter's own blocks — because both cheaper approximations are wrong
         * on real figures. "The window holds an insertion" puts a swatch on a
         * callset of short indels, which can never draw a marker at any zoom.
         * "The window holds a *long* insertion" puts one on any view zoomed out
         * far enough that even a long bar falls under the 2px cell floor; that
         * was three of the fourteen committed figures carrying this display,
         * each gaining exactly one 576px swatch and no glyph.
         *
         * So the entry does come and go with zoom, unlike `hasSecondaryAlt` /
         * `hasNoCall`. That is the honest behavior for a glyph whose visibility
         * is itself a function of zoom, and it is why this reads the view: the
         * components that call `legendSections` are the same ones that already
         * read `renderState`.
         */
        get insertionLegendColor(): string | undefined {
          if (!getConf(self, 'showInsertionGlyphs')) {
            return undefined
          }
          const drawnRowHeight = drawnCellHeightPx(self.renderState.rowHeight)
          for (const block of self.renderBlocks) {
            const region = self.perRegionCellMap.get(block.displayedRegionIndex)
            if (
              region?.numCells &&
              markersForBlock(region, block, drawnRowHeight).anyMarker
            ) {
              return getSession(self).palette.insertion
            }
          }
          return undefined
        },
        /**
         * #getter
         * Per-region spatial index over feature intervals, for the hit-test. One
         * entry per variant, not per cell — see computeVariantCells.
         */
        get featureIndices() {
          const out = new Map<number, Flatbush>()
          for (const [regionIdx, region] of self.perRegionCellMap) {
            out.set(regionIdx, Flatbush.from(region.featureIndexData))
          }
          return out
        },
      }))
      // separate block so renderSvg's `self` sees perRegionCellMap/renderBlocks
      // and insertionGlyphRegions
      .views(self => ({
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
      .actions(self => ({
        startRenderingBackend(backend: VariantRenderingBackend) {
          // Same whole-map reference diff canvas uses: perRegionCellMap is one
          // MobX computed rebuilt on any cellData change, so per-key autoruns
          // (installPerRegionLifecycle) can't help here — they'd still track the
          // whole computed. The helper owns the prune and the context-loss reset.
          const syncRegions = createRegionUploadSync<
            VariantUploadData,
            VariantRenderingBackend
          >()
          self.attachRenderingBackend<VariantRenderingBackend>(backend, {
            upload: b => {
              syncRegions(b, self.perRegionCellMap)
            },
            render: b =>
              b.renderBlocks(
                self.renderBlocks,
                self.perRegionCellMap,
                self.renderState,
              ),
          })
        },
      }))
  )
}

export type LinearMultiSampleVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearMultiSampleVariantDisplayModel =
  Instance<LinearMultiSampleVariantDisplayStateModel>

export default stateModelFactory
