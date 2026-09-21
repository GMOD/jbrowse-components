import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { legendIsReadable } from '@jbrowse/core/ui'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { assembleLocString, getDialogHost } from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import { thresholdLabels } from '@jbrowse/core/util/thresholdScale'
import LegendMixin, {
  legendCheckboxItem,
} from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { colorSpecOf } from '@jbrowse/display-kit/channelSpec'
import {
  colorMembersOf,
  colorScaleChoicesOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { fetchAllRegions } from '@jbrowse/display-kit/fetchEachRegion'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { types } from '@jbrowse/mobx-state-tree'
import {
  ContextMenuMixin,
  TreeSidebarMixin,
  buildSpatialIndex,
  clusteringMenuItem,
  computeClusterHierarchy,
  filterRowsBySubtree,
  focusRowGroup,
  orderRowsByDomain,
  reconcileLayout,
  resetRowOrderMenuItems,
  rowArrangementMenuItem,
  rowLabelsCarryText,
  setupTreeSidebarAutoruns,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
  sortRowsAtColumn,
  sortRowsHereMenuItem,
  treeSidebarOffset,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import { axisPlotBox, makeCrossHatchItem } from '@jbrowse/wiggle-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { installWiggleRenderingBackend } from '../shared/installWiggleRenderingBackend.ts'
import {
  declaredCuts,
  resolveWiggleColor,
  sourcePalette,
  wiggleColorEncoding,
  wiggleColorNotices,
} from '../shared/wiggleColor.ts'
import { getRowHeight, getRowTop } from '../shared/wiggleComponentUtils.ts'
import { wiggleDisplayViews } from '../shared/wiggleDisplayViews.ts'
import {
  makeLineWidthMenuItems,
  makePointSizeMenuItems,
  makeRenderingTypeSubMenu,
  makeResolutionSubMenu,
  makeWiggleScoreSubMenu,
} from '../shared/wiggleMenuItems.tsx'
import { WIGGLE_RENDERINGS } from '../util.ts'
import { CHANNEL_SPEC_EXAMPLES } from './channelSpecExamples.ts'
import { buildLegendItems } from './legendItems.ts'
import { sortSourcesByScoreAt } from './sortSourcesByScoreAt.ts'
import { buildSources, sourcesFromRegionData } from './sourcesLogic.ts'

import type { SatisfiesComponentContract } from '../shared/componentContract.ts'
import type { ResolvedWiggleColor } from '../shared/wiggleColor.ts'
import type { WiggleHoveredFeature, Source } from '../util.ts'
import type { WiggleContextInfo } from './components/findHit.ts'
import type { WiggleDisplayModel } from './components/wiggleDisplayTypes.ts'
import type { LinearWiggleDisplayConfigSchema } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ContextMenuAnchor, LegendItem, MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ChannelSpec } from '@jbrowse/display-kit/channelSpec'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { FacetSetting } from '@jbrowse/display-kit/facetConfigSchema'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ValueScale, WiggleRenderingBackend } from '@jbrowse/wiggle-core'

const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const ChannelSpecDialog = lazy(
  () => import('@jbrowse/display-kit/ChannelSpecDialog'),
)
const WiggleClusterDialog = lazy(
  () => import('./components/WiggleClusterDialog.tsx'),
)

/**
 * #stateModel LinearWiggleDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * #category display
 *
 * The quantitative display: one plot per rendering, drawn over one source or
 * over many. `facet: 'source'` gives each source a row of its own, with the
 * clustering sidebar, row labels and separators beside them; unfaceted, every
 * source shares one plot box.
 *
 * #example
 * A complete `QuantitativeTrack` config to paste into `tracks`:
 * ```js
 * {
 *   type: 'QuantitativeTrack',
 *   trackId: 'coverage',
 *   name: 'Coverage',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
 *   displays: [
 *     {
 *       type: 'LinearWiggleDisplay',
 *       displayId: 'coverage-LinearWiggleDisplay',
 *       height: 100,
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * The two row-ordering triggers are display *properties*, not config slots, so
 * they go on the display node in a session — `defaultSession` here, and the
 * same shape a `session=spec-` link carries. Written on the track config's own
 * `displays` entry they would be dropped as unknown slots.
 *
 * `runClustering` is a transient declarative launch spec, the same idea as
 * `LinearGenomeView`'s `init`: it runs the real "Cluster columns" RPC once
 * automatically (no dialog) as soon as subtrack data is available, then clears
 * itself so a saved session never re-triggers it. `sortRowsBy` is the other
 * one, and the declarative form of the right-click "Sort rows by score here" —
 * where clustering orders rows by the whole region in view, this ranks them by
 * the score each carries at one base, so a cohort can open already ranked at a
 * candidate locus with the surrounding context still on screen. Use one or the
 * other; whichever applies last owns the row order.
 * ```js
 * defaultSession: {
 *   name: 'Copy number at CCL3L1',
 *   views: [
 *     {
 *       type: 'LinearGenomeView',
 *       assembly: 'hg38',
 *       loc: 'chr17:36,080,000-36,270,000',
 *       tracks: [
 *         {
 *           trackId: 'pur_copynumber_1000g',
 *           type: 'LinearWiggleDisplay',
 *           sortRowsBy: { refName: 'chr17', pos: 36180000 },
 *         },
 *       ],
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: LinearWiggleDisplayConfigSchema,
) {
  return types
    .compose(
      'LinearWiggleDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      WiggleCommonMixin(),
      StoredHoverMixin<WiggleHoveredFeature>(),
      LegendMixin(),
      TreeSidebarMixin<Source>(),
      ContextMenuMixin<ContextMenuAnchor & WiggleContextInfo>(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearWiggleDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        // `runClustering` / `clusterRegion` / `sortRowsBy` are
        // TreeSidebarMixin's. The one thing specific to this display: naming a
        // `clusterRegion` also moves where the sampling density comes from,
        // since the matrix columns are pixel bins over the span rather than
        // over the view's zoom (clusterScoreMatrixArgs).
      }),
    )
    .views(self => ({
      // overrides WiggleScoreConfigMixin's `false` base, which is what its
      // showCrossHatches / effectiveSummaryScoreMode getters key on
      get isDensityMode() {
        return self.renderingType === 'density'
      },

      /**
       * #getter
       * The `color` object as written, `value` undefined while nothing names
       * a colour and the layout decides (`effectiveColor`).
       */
      get colorSetting(): ColorSetting {
        return {
          value: getConf(self, ['color', 'value']),
          field: getConf(self, ['color', 'field']) ?? '',
          scale: getConf(self, ['color', 'scale']),
          domain: getConf(self, ['color', 'domain']),
          range: getConf(self, ['color', 'range']),
          scheme: getConf(self, ['color', 'scheme']),
          reverse: getConf(self, ['color', 'reverse']),
          domainMid: getConf(self, ['color', 'domainMid']),
        }
      },

      /**
       * #getter
       * The scales this display's colour paints, for the Edit as JSON box.
       */
      get colorScaleChoices(): string[] {
        return colorScaleChoicesOf(self.configuration.color)
      },

      /**
       * #getter
       * The members this display's colour object declares, for the Edit as
       * JSON box.
       */
      get colorMembers(): string[] {
        return colorMembersOf(self.configuration.color)
      },

      /**
       * #getter
       */
      get channelSpecExamples() {
        return CHANNEL_SPEC_EXAMPLES
      },

      /**
       * #method
       * A wiggle colours per signal and keeps no runtime filter list, so a
       * spec naming `filter` is refused rather than silently dropped.
       */
      channelSpecProblems(spec: ChannelSpec) {
        return spec.filter === undefined
          ? []
          : ['filter: a quantitative display filters nothing']
      },

      /**
       * #getter
       * The `facet` object as written, or undefined while every source shares
       * one plot. `source` is the only field the config admits here.
       */
      get facet(): FacetSetting | undefined {
        return facetSettingOf({
          field: getConf(self, ['facet', 'field']),
          domain: getConf(self, ['facet', 'domain']),
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether each source takes a row of its own, which is the whole of what
       * the facet decides here: the tree sidebar, the row labels, the
       * separators, the clustering menu and the row-order sort all hang off it.
       */
      get isFaceted() {
        return !!self.facet
      },

      /**
       * #getter
       * `TreeSidebarMixin`'s hook, overridden: this display declares no
       * `domain` slot of its own, because the row order is the facet's — one
       * word for one idea, and `domain` on a wiggle display is already the
       * score axis.
       */
      get rowDomain(): string[] {
        return [...(self.facet?.domain ?? [])]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Every source in one plot box. The complement of the facet, named for
       * what is drawn rather than for the setting that is off.
       */
      get isOverlay() {
        return !self.isFaceted
      },
    }))
    .views(self => {
      // This list reaches `gpuProps()`, whose identity re-encodes every loaded
      // region, and a plain getter would hand out a fresh array on every region
      // arrival — `stableIdentityComputed` keeps the previous one while the row
      // metadata is unchanged, which is what a refetch of the same track
      // produces.
      const sources = stableIdentityComputed(() =>
        sourcesFromRegionData(self.rpcDataMap),
      )
      return {
        // Raw adapter sources, discovered from the loaded regions in adapter
        // order. Used as input to clustering: cluster RPC reads `name` and
        // `buildClusteredLayout` maps order indices into this list.
        get sourcesWithoutLayout(): Source[] {
          return sources.get()
        },

        // Adapter rows merged with the user's saved arrangement, in layout order —
        // no subtree filter and no palette synthesis, so the edit dialog only
        // persists colors the user actually chose. `reconcileLayout` owns the
        // membership rules (drop layout entries the adapter no longer reports,
        // append subtracks the layout never saw) and is shared with every other
        // multi-row display, so this display has nothing of its own to keep in
        // step. It used to, and that was the whole job of the wrapper this
        // replaced: aliasing `source` onto `name` before handing the rows over.
        //
        // The config `domain` seeds the order underneath: the subtracks it
        // names lead, the rest keep adapter order. Both helpers hand back the
        // array they were given when they change nothing, which is what keeps
        // `gpuProps`'s identity steady on the ordinary track.
        get editableSources(): Source[] {
          return reconcileLayout(
            orderRowsByDomain(this.sourcesWithoutLayout, self.rowDomain),
            self.layout,
          )
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * The rows a clustering run acts on: `editableSources` narrowed to the
       * focused clade, and deliberately NOT the decorated `sources` below —
       * `clusteredCladeLayout` writes what it is handed into `layout`, where a
       * synthesized palette color has no business. Under no subtree filter this
       * is `editableSources` itself.
       */
      get clusterableSources(): Source[] {
        return filterRowsBySubtree(self.editableSources, self.subtreeFilter)
      },
      /**
       * #getter
       * Whether several plots share one box, which is the one thing the layout
       * decides about colour: overlaid sources need a palette entry each to be
       * told apart, where a lone plot has nothing to be told apart from and is
       * the pos/neg picture a quantitative track has always drawn.
       */
      get sharesOnePlot(): boolean {
        return self.isOverlay && self.editableSources.length > 1
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The colour actually painted: what the config says, or the picture the
       * layout asks for where it says nothing. A resolved getter rather than a
       * `defaultValue`, because the default moves with the layout and a slot
       * default cannot.
       */
      get effectiveColor(): ColorSetting {
        const color = self.colorSetting
        if (color.value !== undefined || color.field) {
          return color
        }
        return self.sharesOnePlot
          ? { ...color, field: 'source', scale: 'categorical' }
          : { ...color, field: 'score', scale: 'threshold' }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `effectiveColor` as it paints, through the one resolver every
       * display's colour object goes through.
       */
      get colorEncoding() {
        return wiggleColorEncoding(self.effectiveColor)
      },
      /**
       * #getter
       * What `colorSetting`'s slots say together that it cannot paint as
       * written, for the corner notice.
       */
      get notices(): string[] {
        return wiggleColorNotices(self.colorSetting)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `colorEncoding` as the encoder and both backends take it.
       */
      get wiggleColor(): ResolvedWiggleColor {
        return resolveWiggleColor(self.colorEncoding, self.origin)
      },

      /**
       * #getter
       * The one colour the circular view's key names this track by
       * (`CircularLegendSource`), which a ring of this display answers where
       * it draws no ramp. The positive side, which is the whole plot wherever
       * nothing parts.
       */
      get legendColor(): string {
        return this.wiggleColor.posColor
      },

      /**
       * #getter
       * `ChannelSpecHost`'s hook: the two settings the Edit as JSON box
       * writes, as written rather than as resolved, so a round trip through
       * the box changes nothing on its own.
       */
      get channelSpec(): ChannelSpec {
        const { facet } = self
        return {
          facet: facet
            ? {
                field: facet.field,
                ...(facet.domain.length ? { domain: [...facet.domain] } : {}),
              }
            : null,
          color: colorSpecOf(self.colorSetting),
        }
      },
    }))
    .views(self => ({
      get sources(): Source[] {
        return buildSources(
          self.editableSources,
          self.subtreeFilter,
          sourcePalette(self.colorEncoding),
          self.isDensityMode,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overrides WiggleCommonMixin's empty base, so the axis reaches a
       * rule of `scales.y.rules` even where the visible data does not.
       *
       * Empty in density, where no rule is drawn: the domain is spent on the
       * colour ramp there, so widening it stretches the ramp over a range
       * nothing on screen reaches.
       */
      get scoreRuleValues() {
        return self.isDensityMode ? [] : self.scoreRules.map(r => r.value)
      },
    }))
    .views(self => ({
      get numSources() {
        return self.sources.length
      },

      // Restrict the shared autoscale domain to the currently-visible sources
      // (a subtree filter hides some), so hidden sources don't stretch the axis.
      get autoscaleSourceNames() {
        return new Set(self.sources.map(s => s.name))
      },

      /**
       * #getter
       * The source key's rows — one per (group, color) pair, colors resolved.
       * `colorScales` and `overlayLegendApplies` both read this one list, so
       * what is drawn and what was counted before deciding to draw cannot
       * disagree. See `buildLegendItems`.
       */
      get legendItems(): LegendItem[] {
        return buildLegendItems(
          self.sources,
          self.isDensityMode,
          self.wiggleColor.posColor,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Resolved per-row height. This display is always fit-to-display-height —
       * there is no pinned-height setting and so no `rowHeight` sentinel to
       * resolve — but it carries the same name every row display exposes its
       * resolved height under (see agent-docs/reference/ROW_HEIGHT_AND_FIT),
       * which is also what tree-sidebar's `TreeDrawingModel` reads.
       */
      get effectiveRowHeight() {
        return self.isOverlay
          ? self.height
          : getRowHeight(self.height, self.numSources)
      },

      /**
       * #getter
       * Rows actually drawn: overlay collapses every source onto one shared
       * plot. Read by the render state and by everything that repeats itself
       * per row (scalebars, cross hatches), so they can't disagree about how
       * many rows exist.
       */
      get numRows() {
        return self.isOverlay ? 1 : self.numSources
      },
    }))
    .views(self => ({
      /**
       * #getter
       * One row takes the scalebar-label gutter at top and bottom, so its end
       * labels are never clipped; a stack of rows gives that up, because the
       * axis is drawn per row and maximum density is the point. `ticks`, the
       * render height, the on-screen canvas and the SVG clip all read this, so
       * a tick stays on the data it labels.
       */
      get plotGeometry() {
        if (self.numRows === 1) {
          const { yTop, plotHeight } = axisPlotBox(self.height)
          return { yTop, plotHeight, numRows: 1, tickHeight: self.height }
        }
        return {
          yTop: 0,
          plotHeight: self.height,
          numRows: self.numRows,
          tickHeight: self.effectiveRowHeight,
        }
      },

      /**
       * #getter
       * Only density spends color on the score, and only when every row shares
       * the one ramp: a source with its own color is drawn on its own pos side
       * (see buildSourceRenderData), so a single bar would describe none of
       * them.
       */
      get scoreRampApplies() {
        return self.isDensityMode && self.sources.every(s => !s.color)
      },
    }))
    .views(self => wiggleDisplayViews(self))
    .views(self => ({
      /**
       * #getter
       * The one scale every row shares, ruling a band per row stacked down the
       * track, past the dendrogram where one is shown. Density rows each in
       * their own colour map the scale to colour rather than to y, so they
       * rule no band and the chrome captions the domain instead; under the
       * one ramp the ramp is the key and carries the domain itself.
       */
      get valueScales(): ValueScale[] {
        if (self.scoreRampApplies) {
          return []
        }
        const { tickHeight, yTop, numRows } = self.plotGeometry
        return [
          {
            domain: self.domain,
            scaleType: self.scaleType,
            height: tickHeight,
            offset: yTop,
            minimalTicks: self.minimalTicks,
            symlogConstant: self.symlogConstant,
            bandTops: self.isDensityMode
              ? []
              : Array.from({ length: numRows }, (_, row) =>
                  getRowTop(row, self.effectiveRowHeight),
                ),
            left: treeSidebarOffset(self),
            rules: self.scoreRules,
          },
        ]
      },
      /**
       * #method
       * summaryScoreMode rides along so an adapter can skip work it cannot be
       * asked to show. A store that keeps min/max beside each mean holds three
       * arrays per level, and `avg` — the default — draws none of them, so
       * sending the mode turns the common case back into one read per level
       * instead of three, and drops the two `processFeaturesFromArrays`
       * allocates per source per region for values it then discards.
       *
       * The raw slot, deliberately, and NOT effectiveSummaryScoreMode. The
       * effective one would be tighter -- density resolves whiskers to avg, so
       * it could skip the read there too -- but it changes when the rendering
       * type changes, and anything in rpcProps invalidates the fetch. That
       * would make switching to density discard the data and re-download it,
       * on every multi-wiggle track, including the ones whose adapter gets its
       * summary for free and gains nothing here. Over-fetching in
       * density-with-whiskers is the cheaper mistake.
       *
       * In rpcProps rather than gpuProps because it changes what is fetched:
       * switching the slot to max has to refetch, since a max nobody read
       * cannot be drawn.
       */
      rpcProps() {
        return {
          ...self.sharedRpcProps(),
          summaryScoreMode: self.summaryScoreMode,
        }
      },

      /**
       * #method
       * The row list is this display's own: the encoder places each payload
       * source by its position here, so a filter or a reorder re-uploads
       * bytes already in hand.
       *
       * The colour rides here and not in `rpcProps`: the worker ships one set
       * of score arrays and the main thread colours each instance by its side
       * of the cut, so a new colour re-encodes and refetches nothing.
       */
      gpuProps() {
        return {
          ...self.sharedGpuProps(),
          sources: self.sources,
          faceted: self.isFaceted,
        }
      },
    }))
    .views(self => ({
      get showRowSeparators(): boolean {
        return getConf(self, 'showRowSeparators')
      },

      /**
       * #getter
       * Whether the source color key applies at all. Gates the menu checkbox,
       * which has to stay visible while the legend is toggled off.
       *
       * Four questions in order, each with its own guard below:
       *
       * 1. **Is there anything to key?** One source names itself by the track
       *    name.
       * 2. **Does anything ELSE on the frame name the colors?** Overlay
       *    collapses every source onto one plot, so nothing does and the key is
       *    the only identification there has ever been — but it still has to
       *    pass (3): overlay's row palette is `set1`, which wraps every nine
       *    sources (`sourcesLogic.ts`), so 40 ungrouped overlay rows would draw
       *    a 40-row key in nine repeating colors. A multi-row track names
       *    its rows beside them — but only while they carry text
       *    (`rowLabelsCarryText`, asked of the drawing side rather than
       *    restated) AND is drawing them at all — `showRowLabels` off means
       *    nothing beside the rows names anything, so the key is once again the
       *    only identification there is. Below that `SvgRowLabels` drops to an
       *    unlabelled swatch,
       *    and a per-cell density track at 0.14 px a row is then a stripe of
       *    nine colors with nothing saying what any of them is; that is the case
       *    this was widened for ("we need to make it so density can show legend
       *    also ideally because the left side labels are too small to see").
       *    `showTree` is deliberately no part of this: the labels are
       *    `WiggleRowLabels`' own and draw whether or not a dendrogram
       *    does, so reading it here drew a key restating labels still on screen.
       * 3. **Is the key worth its rows?** Short enough to read, and made of
       *    more than one color — both `legendIsReadable`, shared with the other
       *    display that has to decide. Asked of `legendItems`, the very list
       *    that gets drawn, so a key can't be counted in one form and rendered
       *    in another. Every mode answers it, overlay included.
       */
      get overlayLegendApplies() {
        const namedBesideTheRows =
          !self.isOverlay &&
          self.showRowLabels &&
          rowLabelsCarryText(self.effectiveRowHeight)
        return (
          self.numSources >= 2 &&
          !namedBesideTheRows &&
          legendIsReadable(self.legendItems)
        )
      },

      /**
       * #getter
       * The key a threshold with declared cuts draws: one row per interval,
       * labelled by the span it covers. A threshold cutting at the `origin`
       * draws none, because the axis already shows where the origin is and a
       * `< 0` / `≥ 0` key on every bigWig says nothing a reader did not ask
       * for. Density draws none either: there the ramp is the key.
       */
      get thresholdColorScale(): ColorScale | undefined {
        const cuts = declaredCuts(self.colorEncoding)
        if (self.isDensityMode || cuts.length === 0) {
          return undefined
        }
        const { posColor, negColor, innerColors } = self.wiggleColor
        const colors = [negColor, ...innerColors, posColor]
        return {
          kind: 'categorical',
          id: 'threshold',
          title: 'score',
          entries: thresholdLabels(cuts).map((label, i) => ({
            value: label,
            label,
            color: colors[i]!,
          })),
        }
      },

      /**
       * #getter
       * Offset the track label above the plot so the left y-axis stays pinned
       * to the content edge instead of dodging right of the label, and so a
       * stack of rows is not hidden behind it. One density plot draws no left
       * axis (just a top score legend), so there let the label overlap.
       */
      get prefersOffset() {
        return !self.isDensityMode || self.isFaceted
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `LegendMixin`'s hook: the density ramp where one describes every row,
       * then the source key where it is worth its rows. A row's `value` is the
       * group or subtrack `focusLegendEntry` narrows to.
       */
      get colorScales(): ColorScale[] {
        const scales: ColorScale[] = []
        if (self.scoreColorScale) {
          scales.push(self.scoreColorScale)
        }
        if (self.thresholdColorScale) {
          scales.push(self.thresholdColorScale)
        }
        if (self.overlayLegendApplies) {
          scales.push({
            kind: 'categorical',
            id: 'sources',
            focusesRows: true,
            entries: self.legendItems.map(({ label, color }) => ({
              value: label,
              label,
              color,
            })),
          })
        }
        return scales
      },

      /**
       * #getter
       * The positioned dendrogram, or undefined in an overlay mode: overlay
       * collapses every source onto one row, so a tree spreading its leaves over
       * the full height would align to nothing. This is the single gate — the
       * on-screen sidebar, the SVG export, `spatialIndex` (subtree hover), and
       * `treeSidebarRightEdge` (the tooltip/crosshair dead zone the sidebar
       * reserves) all read it, so none of them can keep drawing or reserving
       * space on their own. A subtree filter set in a row mode still applies and
       * is still clearable from the track menu and WiggleHint.
       */
      get hierarchy() {
        return self.isOverlay
          ? undefined
          : computeClusterHierarchy(
              self.root,
              self.sources,
              self.height,
              self.treeAreaWidth,
              self.showBranchLength,
            )
      },
    }))
    .views(self => ({
      get spatialIndex() {
        return buildSpatialIndex(self.hierarchy)
      },
    }))
    .actions(self => ({
      startRenderingBackend(backend: WiggleRenderingBackend) {
        installWiggleRenderingBackend(self, backend)
      },

      setShowRowSeparators(arg: boolean) {
        setConf(self, 'showRowSeparators', arg)
      },

      /**
       * #action
       * The whole colour object at once, since a scale and the slots it reads
       * are one setting; `undefined` returns to the layout's own picture.
       */
      setColor(color?: Partial<ColorSetting> | string) {
        self.configuration.setSubschema('color', color ?? {})
      },

      /**
       * #action
       * The layout half of a Plot type leaf — `Multi-row` or `Overlapping`,
       * each holding the five plot names. Writes the field alone: an order
       * declared in `facet.domain` survives a trip through the shared plot and
       * comes back with the rows. Writing the object whole would not —
       * `rowDomain` reads the order back through `facet`, which is undefined
       * while the sources share a plot.
       */
      setFaceted(on: boolean) {
        setConf(self, ['facet', 'field'], on ? 'source' : '')
      },

      /**
       * #action
       * `LegendMixin`'s hook: narrow the rows to the subtracks one key row
       * stands for — what clicking that swatch does. A key row is a group
       * where the subtrack has one and the subtrack itself otherwise
       * (`buildLegendItems`), so this matches the same way.
       */
      focusLegendEntry(_scaleId: string, label: string) {
        focusRowGroup(
          self,
          self.editableSources,
          s => (s.group ?? s.label ?? s.name) === label,
        )
      },

      /**
       * #action
       * The Edit color... row: the colour object, and the facet beside it,
       * as JSON.
       */
      openChannelSpecDialog(seed?: ChannelSpec) {
        getDialogHost(self).queueDialog(handleClose => [
          ChannelSpecDialog,
          { model: self, seed, handleClose },
        ])
      },

      /**
       * #action
       * Rank the rows by each source's score at one genomic base. Reads the
       * region data already in hand — no refetch, no RPC — and writes the
       * order through `layout`, the same channel clustering and the
       * arrangement dialog write, so "Reset row order" undoes all three.
       *
       * Named by coordinate rather than by loaded-region index because both
       * entry points are: the right-click hit resolves to one, and a session's
       * `sortRowsBy` carries one across a reload. Resolving that region and
       * refusing the two cases where a sort would only cost a `layout` write
       * are `sortRowsAtColumn`'s, shared with the multi-row feature display's
       * twin, and so is the returned "did it sort" the declarative entry point
       * reads to decide whether to keep its trigger for a later fetch.
       */
      sortRowsByScoreAt(refName: string, pos: number) {
        return sortRowsAtColumn(
          self,
          refName,
          pos,
          index => self.rpcDataMap.get(index),
          (sources, data) =>
            sortSourcesByScoreAt(
              sources,
              data,
              pos,
              self.effectiveSummaryScoreMode,
            ),
        )
      },
    }))
    .actions(self => ({
      fetchNeeded(needed: IndexedRegion[]) {
        const view = self.host
        // Always fetch the full (unfiltered, un-reordered) source list. A
        // subtree filter or reorder only affects client-side rendering
        // (gpuProps re-upload) and the autoscale domain — never what's
        // fetched — so every region's payload stays complete and consistent.
        // Filtering here instead would leave regions fetched under a stale
        // filter missing sources when the filter is later widened.
        const { sourcesWithoutLayout } = self
        const { bpPerPx } = view
        // Batched, not per-region: every subtrack adapter gets all the
        // visible regions in one call, so a whole-genome or
        // collapsed-intron view coalesces each file's on-disk blocks into
        // one pass instead of one pass per region per subtrack. The
        // regions land together rather than painting progressively.
        return fetchAllRegions(self, needed, {
          call: (regions, ctx) =>
            ctx.callRpc('RenderMultiWiggleData', {
              ...rpcArgs(self),
              regions,
              sources: sourcesWithoutLayout,
              bpPerPx,
            }),
          onResult: (_idx, result) => result,
        })
      },

      afterAttach() {
        setupTreeSidebarAutoruns(self, {
          name: 'Wiggle',
          // Forwarded, not swallowed: `false` is "no loaded region covers that
          // column", and it holds `sortRowsBy` for the fetch that will.
          sortRows: (refName, pos) => self.sortRowsByScoreAt(refName, pos),
          // "Cluster rows by score": the score-matrix RPC over the
          // `clusterRegion` locus if the session named one and the visible
          // blocks if not. Refuses a single row, matching the track menu's gate
          clustering: {
            ready: () => self.clusterableSources.length > 1,
            run: async args => {
              const [{ runWiggleClustering }, { DEFAULT_SAMPLES_PER_PIXEL }] =
                await Promise.all([
                  import('./runWiggleClustering.ts'),
                  import('./components/clusterOptions.ts'),
                ])
              await runWiggleClustering({
                model: self,
                // the default density, not the dialog's persisted preference —
                // see DEFAULT_SAMPLES_PER_PIXEL for why this path ignores it
                samplesPerPixel: DEFAULT_SAMPLES_PER_PIXEL,
                ...args,
              })
            },
          },
        })
      },
    }))
    .views(self => ({
      trackMenuItems() {
        const showItems: MenuItem[] = [
          // the tree, row separators and row labels only render in multi-row
          // modes, not overlays — an overlay is one row and names itself by
          // the track name, and draws no dendrogram (see `hierarchy`). A
          // persisted `showTree` is left untouched, so it comes back on
          // return to a row mode
          ...(self.isOverlay
            ? []
            : [
                ...treeSidebarShowMenuItems(self),
                showRowSeparatorsMenuItem(self),
                showRowLabelsMenuItem(self),
              ]),
          // The key stays in the menu whatever the rendering, so its
          // display-type pin is reachable; it greys out where nothing on the
          // frame is identified by colour.
          legendCheckboxItem(self, {
            disabled: !self.hasLegendKey,
            disabledHelpText:
              'Nothing here is keyed by colour: height carries the score, and a source on its own row is named beside it',
          }),
          // density maps score to color, so score-axis cross hatches are
          // meaningless there (`showCrossHatches` enforces the same on the
          // drawing side)
          ...(self.isDensityMode ? [] : [makeCrossHatchItem(self)]),
        ]
        return [
          makeRenderingTypeSubMenu(self, WIGGLE_RENDERINGS),
          // A row order is something to have only once the sources are on rows;
          // the row-count half of the gate is `clusteringMenuItem`'s, off the
          // count below. "Reset row order" is top-level rather than inside the
          // Clustering submenu, where it used to sit as "Clear clustering" —
          // see resetRowOrderMenuItems.
          ...(self.isFaceted
            ? [
                clusteringMenuItem(
                  self,
                  {
                    label: 'Cluster rows by score...',
                    onClick: () => {
                      getDialogHost(self).queueDialog(handleClose => [
                        WiggleClusterDialog,
                        {
                          model: self,
                          handleClose,
                        },
                      ])
                    },
                  },
                  self.clusterableSources.length,
                ),
                ...resetRowOrderMenuItems(self),
              ]
            : []),
          ...makeResolutionSubMenu(self),
          makeWiggleScoreSubMenu(self),
          ...makeShowSubMenu(showItems),
          // point size / line width are top-level submenus, each present only in
          // its respective scatter / line rendering
          ...makePointSizeMenuItems(self),
          ...makeLineWidthMenuItems(self),
          {
            label: 'Edit color...',
            onClick: () => {
              self.openChannelSpecDialog()
            },
          },
          rowArrangementMenuItem({
            ready: !!self.sourcesWithoutLayout.length,
            onOpen: () => {
              getDialogHost(self).queueDialog(handleClose => [
                SetColorDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          }),
        ]
      },

      /**
       * #method
       * Right-click menu, built from the column the click landed on. The
       * position is captured here rather than read inside the onClick, because
       * `closeContextMenu` runs first when an item is clicked.
       */
      contextMenuItems(): MenuItem[] {
        const info = self.contextMenuInfo
        if (!info) {
          return []
        }
        const { feature } = info
        return [
          // overlay collapses every source onto one plot, so there is no row
          // axis for a ranking to be read down
          ...(self.isOverlay
            ? []
            : [
                sortRowsHereMenuItem({
                  label: 'Sort rows by score here',
                  rowCount: self.editableSources.length,
                  onClick: () => {
                    self.sortRowsByScoreAt(info.refName, info.bp)
                  },
                }),
              ]),
          // The two rows the multi-row painting and the variant displays offer
          // on a right-click, under the labels they use, so one action is not
          // three names across three displays. They are about the bin the
          // pointer is on where the sort is about the rows, and they need the
          // hit rather than the column — a gap has no record to open or paste.
          ...(feature
            ? [
                {
                  label: 'Open feature details',
                  icon: MenuOpenIcon,
                  onClick: () => {
                    self.selectFeature(feature)
                  },
                },
                {
                  label: 'Copy location',
                  icon: ContentCopyIcon,
                  onClick: () => {
                    void copyText(
                      self,
                      assembleLocString({
                        refName: feature.refName,
                        start: feature.start,
                        end: feature.end,
                      }),
                      'location',
                    )
                  },
                },
              ]
            : []),
          // stays in an overlay mode, where the sort doesn't: an order set in a
          // row mode is still what that display comes back to
          ...resetRowOrderMenuItems(self),
        ]
      },
    }))
    .actions(self => ({
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
    }))
}

// Re-exported off the module the `LinearWiggleDisplay/stateModel` subpath
// names, because gccontent composes this factory and its emitted `.d.ts` has to
// name every type the inferred model mentions. Without these the ESM build
// reports TS2883 against the source paths, which no package can import.
export type { WiggleContextInfo } from './components/findHit.ts'
export type { ResolvedWiggleColor } from '../shared/wiggleColor.ts'

export type LinearWiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearWiggleDisplayModel = Instance<LinearWiggleDisplayStateModel>

// See SatisfiesComponentContract for why this guard exists and why it's spelled
// out in each model file rather than centralized.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelSatisfiesComponentContract = SatisfiesComponentContract<
  WiggleDisplayModel,
  LinearWiggleDisplayModel
>
