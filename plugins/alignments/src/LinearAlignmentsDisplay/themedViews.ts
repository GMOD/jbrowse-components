import { getPaletteHost } from '@jbrowse/core/util'
import { computed } from 'mobx'

import { buildArcBandFeeds } from '../features/arcs/bandFeed.ts'
import { buildJunctionsBandFeeds } from '../features/junctions/bandFeed.ts'
import { buildConnectorFeeds } from '../features/linkedReads/connectorFeed.ts'
import { connectorStyler } from '../features/linkedReads/connectorStyle.ts'
import {
  getAlignmentsColorScales,
  junctionLegend,
} from '../shared/legendUtils.ts'
import { pileupRowsOnScreen } from './components/sectionScreen.ts'

import type { ArcBandFeed } from '../features/arcs/bandFeed.ts'
import type { ArcsByGroupResult } from '../features/arcs/compute.ts'
import type { JunctionsBandFeed } from '../features/junctions/bandFeed.ts'
import type { ConnectorFeed } from '../features/linkedReads/connectorFeed.ts'
import type { ConnectorStyler } from '../features/linkedReads/connectorStyle.ts'
import type { ColorPalette } from '../shaders/colors.ts'
import type { DeclaredReadLabels } from '../shared/alignmentsColor.ts'
import type { alignmentsColorViews } from './alignmentsColorViews.ts'
import type { ScrollModel } from './components/sectionScreen.ts'
import type { connectionKeyViews } from './connectionKeyViews.ts'
import type { JunctionsPlacement } from './constants.ts'
import type { junctionViews } from './junctionViews.ts'
import type { LaneSection } from './lanes.ts'
import type { SectionSource } from './renderers/rendererTypes.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const NO_JUNCTION_FEEDS_BY_GROUP: ReadonlyMap<
  string,
  ReadonlyMap<number, JunctionsBandFeed>
> = new Map()
const NO_JUNCTION_FEEDS: ReadonlyMap<number, JunctionsBandFeed> = new Map()
const NO_HANGING_JUNCTION_KEYS: ReadonlySet<string> = new Set()
const NO_ARC_FEEDS: ReadonlyMap<number, ArcBandFeed> = new Map()
const NO_CONNECTOR_FEEDS: ReadonlyMap<number, ConnectorFeed> = new Map()

/**
 * The read palette in one theme and the marks colored from it, by group and
 * displayed region, joined to the laid-out sections in stacking order.
 */
export interface ThemedSources {
  colors: ColorPalette
  arcFeedsByGroup: ReadonlyMap<string, ReadonlyMap<number, ArcBandFeed>>
  junctionFeedsByGroup: ReadonlyMap<
    string,
    ReadonlyMap<number, JunctionsBandFeed>
  >
  connectorFeedsByGroup: ReadonlyMap<string, ReadonlyMap<number, ConnectorFeed>>
  sourceSections: SectionSource[]
}

type ColorViews = ReturnType<typeof alignmentsColorViews>
type JunctionViews = ReturnType<typeof junctionViews>
type ConnectorFeedArgs = Parameters<typeof buildConnectorFeeds>[0]

/** What {@link themedViews} reads. */
export interface ThemedHost extends IStateTreeNode {
  colorsIn: (theme: JBrowsePalette) => ColorPalette
  arcsResult: ArcsByGroupResult
  displayedRegionInfos: Parameters<typeof buildArcBandFeeds>[0]['displayed']
  drawsJunctions: boolean
  junctionSections: JunctionViews['junctionSections']
  effectiveJunctionsPlacement: JunctionsPlacement
  view: { displayedRegions: ConnectorFeedArgs['displayedRegions'] }
  connectorPairSections: readonly {
    groupKey: string
    pairs: ConnectorFeedArgs['pairs']
    pileupHeight: number
    dipFloor: number
  }[]
  featureHeight: number
  featureSpacing: number
  declaredReadLabels: DeclaredReadLabels
  renderSections: readonly LaneSection[]
  rowHeight: number
  scrollModel: ScrollModel
  colorRamps: ColorViews['colorRamps']
  colorKeyTitle: string | undefined
  paintsPlainFill: boolean
  legendItems: ColorViews['legendItems']
  arcLegendTitle: string
  connectionLegendItems: ReturnType<
    typeof connectionKeyViews
  >['connectionLegendItems']
  junctionLegendKeys: JunctionViews['junctionLegendKeys']
}

/**
 * The read palette in a theme and the marks colored from it, and the color
 * key `LegendMixin` draws.
 */
export function themedViews(self: ThemedHost) {
  function themedIn(theme: JBrowsePalette): ThemedSources {
    const colors = computed(() => self.colorsIn(theme))
    const arcFeedsByGroup = computed(() => {
      const { byGroup, crossRegionByGroup } = self.arcsResult
      const displayed = self.displayedRegionInfos
      return new Map(
        [...byGroup].map(([key, byRegion]) => [
          key,
          buildArcBandFeeds({
            byRegion,
            crossRegion: crossRegionByGroup.get(key) ?? [],
            displayed,
            colors: colors.get(),
          }),
        ]),
      )
    })
    const junctionFeedsByGroup = computed(() => {
      if (!self.drawsJunctions) {
        return NO_JUNCTION_FEEDS_BY_GROUP
      }
      const displayed = self.displayedRegionInfos
      return new Map(
        self.junctionSections.map(sec => [
          sec.groupKey,
          buildJunctionsBandFeeds({
            junctions: sec.junctions,
            downJunctionKeys:
              self.effectiveJunctionsPlacement === 'above'
                ? NO_HANGING_JUNCTION_KEYS
                : sec.junctionsStripKeys,
            displayed,
            colors: colors.get(),
          }),
        ]),
      )
    })
    const connectorFeedsByGroup = computed(() => {
      const { displayedRegions } = self.view
      return new Map(
        self.connectorPairSections.map(sec => [
          sec.groupKey,
          buildConnectorFeeds({
            pairs: sec.pairs,
            displayedRegions,
            featureHeight: self.featureHeight,
            featureSpacing: self.featureSpacing,
            pileupHeight: sec.pileupHeight,
            dipFloorPx: sec.dipFloor,
            colors: colors.get(),
            labels: self.declaredReadLabels.categories,
          }),
        ]),
      )
    })
    const sourceSections = computed(() =>
      self.renderSections.map(({ groupKey, laidOutPileupMap }) => ({
        groupKey,
        laidOutPileupMap,
        arcFeeds: arcFeedsByGroup.get().get(groupKey) ?? NO_ARC_FEEDS,
        junctionFeeds:
          junctionFeedsByGroup.get().get(groupKey) ?? NO_JUNCTION_FEEDS,
        connectorFeeds:
          connectorFeedsByGroup.get().get(groupKey) ?? NO_CONNECTOR_FEEDS,
      })),
    )
    return {
      get colors() {
        return colors.get()
      },
      get arcFeedsByGroup() {
        return arcFeedsByGroup.get()
      },
      get junctionFeedsByGroup() {
        return junctionFeedsByGroup.get()
      },
      get connectorFeedsByGroup() {
        return connectorFeedsByGroup.get()
      },
      get sourceSections() {
        return sourceSections.get()
      },
    }
  }
  return {
    /**
     * #getter
     * The read colors in the session theme and the marks colored from
     * them (`themedIn`).
     */
    get themed(): ThemedSources {
      return themedIn(getPaletteHost(self).palette)
    },

    /**
     * #method
     * The read palette over `theme`, with the category colors `encoding.color`
     * sets, and the read connections and splice junctions colored from
     * it, each joined to its laid-out section. The SVG export passes the
     * theme it renders with. Each member is its own computed, so while
     * `themed` is observed a member rebuilds only when what it reads
     * changes.
     */
    themedIn,

    /**
     * #method
     * How this display's connectors paint a connection between two
     * reads, in `theme`. The breakpoint split view draws its curves
     * between panels through it, so they agree with the arcs and
     * connectors inside each panel.
     */
    connectorStylerIn(theme: JBrowsePalette): ConnectorStyler {
      return connectorStyler({
        colors: self.colorsIn(theme),
        labels: self.declaredReadLabels.categories,
      })
    },

    /**
     * #getter
     * `LegendMixin`'s hook: the read fills, the arc or read-cloud colors,
     * the connection curves and the junction strands, merged and deduped
     * by `getAlignmentsColorScales`. Empty while the legend is hidden,
     * since the category scans are.
     */
    get colorScales(): ColorScale[] {
      return this.colorScalesIn(getPaletteHost(self).palette)
    },

    /**
     * #getter
     * Always true: the key's category scans run only while the legend
     * is shown, so `colorScales` is empty while it is hidden and could
     * never offer the row that shows it.
     */
    get hasLegendKey() {
      return true
    },

    /**
     * #getter
     * Each lane's pileup rows on screen, the only ones the key may name.
     */
    get keyRows() {
      return new Map(
        self.renderSections.map(sec => [
          sec.groupKey,
          pileupRowsOnScreen(sec, self.rowHeight, self.scrollModel),
        ]),
      )
    },

    /**
     * #method
     * `colorScales` in another theme: the SVG export's, whose theme need
     * not be the session's.
     */
    colorScalesIn(theme: JBrowsePalette): ColorScale[] {
      const palette = self.colorsIn(theme)
      return getAlignmentsColorScales({
        ramps: self.colorRamps,
        colorTitle: self.colorKeyTitle,
        plainFill: self.paintsPlainFill,
        legendItems: () => self.legendItems(palette, this.keyRows),
        arcLegendTitle: self.arcLegendTitle,
        arcLegendItems: () => self.connectionLegendItems(palette),
        junctionLegend: junctionLegend(
          self.junctionLegendKeys.strands,
          theme.alignmentFill,
          { classes: self.junctionLegendKeys.splitClasses, palette },
        ),
      })
    },
  }
}
