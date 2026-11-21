import { firstSectionHighlight } from './components/arcHitTest.ts'
import { selectedConnectorHighlight } from './components/connectorHitTest.ts'
import { JUNCTION_FEATURE_ID_PREFIX } from './components/junctionArcs.ts'
import { selectedJunctionHighlight } from './components/junctionHitTest.ts'
import {
  readHighlightInk,
  readsToLight,
  slotsOfIds,
} from './components/readHighlightInk.ts'
import { NO_CONNECTOR_READ_IDS } from './hoverState.ts'
import { chainReadIdsAt } from './readLookup.ts'
import { connectorBandState } from './renderers/connectorMarks.ts'
import { junctionsBandState } from './renderers/junctionMarks.ts'

import type { HoveredJunction } from '../features/junctions/supportingReads.ts'
import type { ReadSlot } from '../shared/readSlot.ts'
import type { ArcHighlight } from './components/arcHitTest.ts'
import type { ScrollModel } from './components/sectionScreen.ts'
import type { AlignmentsUnit } from './constants.ts'
import type { AlignmentsHover } from './hoverState.ts'
import type { LaneSection } from './lanes.ts'
import type { findRead } from './readLookup.ts'
import type { DisplayRenderState } from './renderers/rendererTypes.ts'
import type { ThemedSources } from './themedViews.ts'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'

type InkArgs = Parameters<typeof readHighlightInk>[0]

/** What {@link highlightViews} reads. */
export interface HighlightHost {
  hoverState: AlignmentsHover | undefined
  unit: AlignmentsUnit
  findFeatureInRpcData: (featureId: string) => ReturnType<typeof findRead>
  readIdsByChainName: ReadonlyMap<string, string[]>
  selectedFeatureId: string | undefined
  renderState: DisplayRenderState
  renderSections: readonly LaneSection[]
  themed: ThemedSources
  connectorPairSections: readonly unknown[]
  junctionSupportingReadSlots: (junction: HoveredJunction) => ReadSlot[]
  readIdIndex: Parameters<typeof slotsOfIds>[1]
  host: { initialized: boolean }
  renderBlocks: InkArgs['blocks']
  scrollModel: ScrollModel
}

/**
 * What the cursor is over and what is selected, and the ink that lights
 * them: the hovered or selected read, its chain, a junction's supporting
 * reads, and the selected junction's and connectors' outlines.
 */
export function highlightViews(self: HighlightHost) {
  return {
    /**
     * #getter
     */
    get featureIdUnderMouse() {
      return self.hoverState?.featureIdUnderMouse
    },
    /**
     * #getter
     */
    get mouseoverExtraInformation() {
      return self.hoverState?.mouseoverExtraInformation
    },
    /**
     * #getter
     * The two read ids at the ends of the connector under the cursor.
     */
    get hoveredConnectorReadIds() {
      return self.hoverState?.hoveredConnectorReadIds ?? NO_CONNECTOR_READ_IDS
    },
    /**
     * #getter
     * The junction or split-read arc under the cursor, whose
     * supporting reads the hover lights.
     */
    get hoveredJunction() {
      return self.hoverState?.hoveredJunction
    },
    /**
     * #getter
     */
    get overCigarItem() {
      return self.hoverState?.overCigarItem ?? false
    },
    /**
     * #getter
     * Screen-px coverage band of the section under a coverage/indicator
     * hover; the tooltip draws its vertical hover bar on it. `undefined`
     * when not hovering.
     */
    get hoverCoverageBand() {
      return self.hoverState?.hoverCoverageBand
    },
    /**
     * #getter
     * The read-connection arc under the cursor, as the ink
     * `ArcHoverOverlay` draws. A snapshot from the mousemove that found
     * the arc, like its tooltip.
     */
    get hoveredArcHighlight() {
      return self.hoverState?.hoveredArcHighlight
    },

    /**
     * #method
     * Read ids sharing a chain with the named read, its own included. Empty
     * outside chain mode, for a read in no chain, and for an id no fetched
     * region holds. The hover, the right-click pin and the selection all
     * light a chain through it.
     */
    readIdsSharingChainWith(featureId: string) {
      const hit =
        self.unit === 'chain' ? self.findFeatureInRpcData(featureId) : undefined
      return hit
        ? chainReadIdsAt(hit.rpcData, hit.idx, self.readIdsByChainName)
        : []
    },

    /**
     * #getter
     * Read ids of the selected read's chain, empty outside chain mode.
     */
    get selectedChainReadIds() {
      const id = self.selectedFeatureId
      return id === undefined ? [] : this.readIdsSharingChainWith(id)
    },

    /**
     * #getter
     * Read ids the hover lights as one: the chain of the read or connector
     * under the cursor, else a connector's two ends.
     */
    get hoverChainReadIds() {
      const ends = this.hoveredConnectorReadIds
      const id = this.featureIdUnderMouse ?? ends[0]
      const chain = id === undefined ? [] : this.readIdsSharingChainWith(id)
      return chain.length > 0 ? chain : ends
    },

    /**
     * #getter
     * The selected splice junction's ink, for the overlay that outlines
     * it. Reads the pan, and only while a junction is selected.
     */
    get selectedJunctionHighlight(): ArcHighlight | undefined {
      const id = self.selectedFeatureId
      return id?.startsWith(JUNCTION_FEATURE_ID_PREFIX)
        ? firstSectionHighlight(
            self.renderState,
            self.renderSections,
            self.themed.junctionFeedsByGroup,
            (feeds, groupKey, sec, state) =>
              selectedJunctionHighlight(
                id,
                groupKey,
                feeds,
                junctionsBandState(state, sec),
              ),
          )
        : undefined
    },

    /**
     * #getter
     * The connectors of the selected read or chain, for the overlay that
     * outlines them. Reads the pan, and only while one is selected.
     */
    get selectedConnectorHighlight(): ArcHighlight | undefined {
      const id = self.selectedFeatureId
      let highlight: ArcHighlight | undefined
      if (id !== undefined && self.connectorPairSections.length > 0) {
        const selected = new Set([id, ...this.selectedChainReadIds])
        highlight = firstSectionHighlight(
          self.renderState,
          self.renderSections,
          self.themed.connectorFeedsByGroup,
          (feeds, _groupKey, sec, state) =>
            selectedConnectorHighlight(
              selected,
              feeds,
              sec,
              connectorBandState(state, sec),
            ),
        )
      }
      return highlight
    },

    /**
     * #getter
     * The boxes of the hovered read or chain, for the chrome's highlight.
     * Not in `renderState`: the hovered id changes on nearly every
     * mousemove, and routing it through the canvas would repaint the whole
     * pileup.
     */
    get hoverInk(): HighlightRect[] {
      const junction = this.hoveredJunction
      if (junction) {
        return this.slotInk(self.junctionSupportingReadSlots(junction), false)
      }
      const { ids, strong } = this.hoverReads
      return this.readInk(ids, strong)
    },

    /**
     * #getter
     * The reads `hoverInk` boxes, and whether it boxes them as one chain.
     */
    get hoverReads() {
      return readsToLight({
        unit: self.unit,
        chainReadIds: this.hoverChainReadIds,
        readId: this.featureIdUnderMouse,
      })
    },

    /**
     * #getter
     * The boxes of the selected read, or of every read in the selected
     * chain — the same walk as `hoverInk`, so a click repaints the guide's
     * divs, not the canvas. Not in the SVG export, as no display's
     * selection is.
     */
    get selectionInk(): HighlightRect[] {
      const { ids, strong } = readsToLight({
        unit: self.unit,
        chainReadIds: this.selectedChainReadIds,
        readId: self.selectedFeatureId,
      })
      return this.readInk(ids, strong)
    },

    /**
     * #method
     * The boxes the named reads painted, every region's copy, clipped to
     * their sections. Reading `readIdIndex` builds over the whole fetched
     * dataset, so it waits until something is hovered or selected.
     */
    readInk(ids: readonly string[], strong: boolean): HighlightRect[] {
      return ids.length > 0
        ? this.slotInk(slotsOfIds(ids, self.readIdIndex), strong)
        : []
    },

    /**
     * #method
     * The boxes the reads in these slots painted, clipped to their
     * sections.
     */
    slotInk(slots: readonly ReadSlot[], strong: boolean): HighlightRect[] {
      return self.host.initialized && slots.length > 0
        ? readHighlightInk({
            blocks: self.renderBlocks,
            sections: self.renderSections,
            slots,
            state: self.renderState,
            scroll: self.scrollModel,
            strong,
          })
        : []
    },
  }
}
