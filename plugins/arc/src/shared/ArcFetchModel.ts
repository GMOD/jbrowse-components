import { getConf, setConf } from '@jbrowse/core/configuration'
import GlobalFetchMixin, {
  blockKeySignature,
} from '@jbrowse/display-kit/GlobalFetchMixin'
import { foundationDisplayStatusPhase } from '@jbrowse/display-kit/foundationDisplayPhase'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import { types } from '@jbrowse/mobx-state-tree'

import { arcFetchPhases } from './fetchArcFeatures.ts'
import { featureScoreRange, makeScoreFilterMenuItem } from './scoreFilter.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { ScoreRange } from './scoreFilter.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type React from 'react'

/**
 * The lazy boundary for the export path — `shared/renderArcSvg.tsx`, which both
 * displays pass. Typed on the bare node rather than on the display: naming
 * either model here is a circular reference through the factory's return type,
 * so the edge narrows inside.
 */
export interface ArcExportEdge {
  renderArcSvg: (model: IStateTreeNode) => Promise<React.ReactNode>
}

// The mixin's own `self` is what it declares, so it cannot see the
// `configuration` and `adapterConfig` the concrete display supplies — the same
// idiom as `LegendMixin`'s `confNode`.
const host = (self: object) => self as ArcDisplayModel

/**
 * Everything the two arc displays share above `GlobalFetchMixin` — the one
 * global foundation (cancel-safe `runFetch`, region-too-large gate,
 * `reload`/`reloadCounter`, `svgReady`, `displayPhase`): the fetched features
 * and their region signature, a **derived** `regionTooLarge` (the byte-only
 * pattern LD and multi-sample variant use, so the banner is a pure function of
 * the last measurement — see RegionTooLargeMixin §"Measurement follows the
 * viewport"), the score filter, the stored hover, the fetch installation and
 * the SVG export. The display adds its glyph geometry and its own menu rows.
 *
 * #stateModel ArcFetchModel
 * #category display
 */
export function ArcFetchModel(exportEdge: () => Promise<ArcExportEdge>) {
  return (
    types
      .compose('ArcFetchModel', GlobalFetchMixin(), types.model({}))
      .volatile(() => ({
        /**
         * #volatile
         */
        features: undefined as Feature[] | undefined,
        /**
         * #volatile
         * Named apart from the `hoveredFeature` getter it fills: `BaseDisplay`
         * declares that hook as a computed and MST refuses a volatile over one.
         */
        hoveredArcFeature: undefined as Feature | undefined,
        /**
         * #volatile
         * Which ARC of that feature, since one feature can lay out as several:
         * `pairKey` keys on endpoints, so a BND record with two ALTs survives
         * dedupe as two arcs sharing one `Feature`. The tooltip looks the
         * caption up by this, not by the feature.
         */
        hoveredArcKey: undefined as string | undefined,
      }))
      .actions(self => ({
        /**
         * #action
         * The shared commit stamps the signature these were fetched for
         * (`GlobalFetchMixin.commitFetchResult`) in the same transaction.
         */
        setFeatures(f: Feature[]) {
          self.features = f
        },
        /**
         * #action
         */
        setHoveredFeature(feature?: Feature, arcKey?: string) {
          self.hoveredArcFeature = feature
          self.hoveredArcKey = arcKey
        },
        /**
         * #action
         * Fills `BaseDisplay`'s hover-clear hook, which the fetch foundation's
         * reaction calls on every viewport change: the arcs move under a
         * stationary cursor with no mouseleave to drop the hover.
         */
        clearHoveredFeature() {
          self.hoveredArcFeature = undefined
          self.hoveredArcKey = undefined
        },
        /**
         * #action
         */
        setMinScore(score: number) {
          setConf(host(self), 'minScore', score)
        },
      }))
      // Opt into RegionTooLargeMixin's shared derived byte gate (self-releases
      // on zoom-in, no flicker on pan): this switch plus the `byteLimit` the
      // fetch passes are the whole opt-in — `ArcGetFeatures` measures before it
      // downloads and the shared commit records what it measured. Byte-only — no
      // density axis. The mixin reads `fetchSizeLimit` / `forceLoad` straight
      // off the display config.
      .views(self => ({
        /**
         * #getter
         */
        get gateEnabled() {
          return true
        },
        /**
         * #getter
         * Fills `BaseDisplay`'s cross-display hover hook, which the view reads
         * to publish `session.hovered`.
         */
        get hoveredFeature() {
          return self.hoveredArcFeature
        },
        /**
         * #getter
         * arcs whose feature scores below this are not drawn; 0 (the default)
         * draws every arc, as does any feature carrying no score
         */
        get minScore(): number {
          return getConf(host(self), 'minScore')
        },
        /**
         * #getter
         * the score span the filter slider is laid out over, `undefined` when the
         * loaded features give it nothing to filter on
         */
        get scoreRange(): ScoreRange | undefined {
          return self.features && featureScoreRange(self.features)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The box the arcs are laid out in: the on-screen canvas and the
         * export's clip rect have to be one number, or a bezier that legitimately
         * bows outside the viewport is clipped on one path and not the other.
         * Same name and same reason as the LD display's, over `totalWidthPx`
         * because arcs span the whole scrolled content rather than the content
         * width alone.
         *
         * Not the `canvasWidth` an SVG body gets from `renderDisplaySvg`, which
         * is the viewport width the shell paints at — see `renderArcSvg`.
         */
        get canvasWidth() {
          return self.host.totalWidthPx
        },
        /**
         * #getter
         * Arc's half of `GlobalFetchMixin`'s freshness compare: the static-block
         * set is the whole staleness axis (there is no `loadedRegions` spatial
         * map — every feature is fetched into one array), so panning or zooming
         * past a block boundary refetches and a scroll inside the loaded blocks
         * does not.
         */
        get viewSignature() {
          const view = self.host
          return view.initialized
            ? blockKeySignature(view.staticBlocks.contentBlocks)
            : undefined
        },
        /**
         * #getter
         * Narrows the foundation's `displayPhase` to the backend-free variant.
         * Arc composes the render lifecycle with the rest of the foundation but
         * never calls `attachRenderingBackend` — it paints its own Canvas2D on
         * screen, and JSX `<path>`s only in the SVG export — so `renderError` is
         * a phase it cannot reach, and the narrower type is what lets
         * `DisplayStatusChrome` (whose
         * banners have no backend `retry()` to offer) accept this display with
         * neither a cast nor a dead branch. On the model rather than derived
         * inside `BaseDisplayComponent` so the component can't disagree with the
         * model, and so arc publishes `data-display-phase` for tests like every
         * other display.
         *
         * `isLoadingOrCanceled`, never a bare `isLoading` — see that getter.
         */
        get displayPhase(): DisplayStatusPhase {
          // no spatial-staleness axis: stale arcs stay on screen under the
          // overlay through a refetch rather than blanking (see `reload`)
          return foundationDisplayStatusPhase(self, () => true)
        },

        /**
         * #getter
         * Arc's first-paint signal, overriding `RenderLifecycleMixin`'s
         * `painted`: nothing ever flips `canvasDrawn` here, because arc attaches
         * no rendering backend, so the data arriving is the signal — or
         * `paintInert`, the two states (a failed fetch, an empty viewport) in
         * which no data ever will. Stays true across a refetch so
         * `data-display-drawn` and the loading anti-flash don't churn on pan;
         * the stricter, staleness-aware `svgReady` is the export gate.
         *
         * On the model rather than derived in `BaseDisplayComponent`, for the
         * same reason `displayPhase` is: this feeds an attribute
         * (`data-display-drawn`) that the screenshot and browser harnesses wait
         * on, and a consumer waiting on a state the display can never leave
         * fails by burning a timeout in silence.
         */
        get painted(): boolean {
          return self.features !== undefined || self.paintInert
        },
        /**
         * #method
         * The "Filter by score" row, or nothing when the data has no score
         * span to filter on — rather than a slider whose ends mean the same
         * thing. Each display spreads it into its own `trackMenuItems`.
         */
        scoreFilterMenuItems(): MenuItem[] {
          const { scoreRange } = self
          return scoreRange ? [makeScoreFilterMenuItem(self, scoreRange)] : []
        },
      }))
      .actions(self => ({
        afterAttach() {
          // Same shared trigger every global display uses (LD, HiC, variant
          // matrix): a debounced autorun that fetches when the data isn't
          // already current. `regionTooLarge` is deliberately not a term: the
          // skeleton owns that skip, and it lets a blocked display fetch once
          // per settled viewport so the pre-flight can re-measure — an index
          // read, not a download.
          const display = host(self)
          installGlobalFetchAutorun(display, {
            ...arcFetchPhases(display),
            delay: 1000,
            name: 'ArcFetch',
          })
        },
        /**
         * #action
         * `opts` is accepted (the export framework calls every display's
         * renderSvg with it) but unused: the export emits vector JSX, not a
         * paintLayer.
         */
        async renderSvg(
          _opts?: ExportSvgDisplayOptions,
        ): Promise<React.ReactNode> {
          const { renderArcSvg } = await exportEdge()
          return renderArcSvg(self)
        },
      }))
  )
}

export type ArcFetchModelType = ReturnType<typeof ArcFetchModel>
