import { connectorCategories } from '../features/linkedReads/computeOverlay.ts'
import { arcSlotCategory } from '../shaders/palettes.ts'
import {
  arcLegendTitle,
  getArcLegendItems,
  throughHiddenLegendItems,
} from '../shared/legendUtils.ts'
import { arcSlotsInWindows, connectorKeyInWindows } from './keyWindows.ts'

import type { ArcsByGroupResult } from '../features/arcs/compute.ts'
import type { GroupConnectors } from '../features/linkedReads/computeOverlay.ts'
import type { ColorPalette } from '../shaders/colors.ts'
import type { ArcCategory } from '../shaders/palettes.ts'
import type { DeclaredReadLabels } from '../shared/alignmentsColor.ts'
import type { ReadConnectionsMode } from './constants.ts'
import type { KeyWindow } from '@jbrowse/display-kit/keyWindows'

/** What {@link connectionKeyViews} reads. */
export interface ConnectionKeyHost {
  showLegend: boolean
  drawnReadConnections: ReadConnectionsMode
  arcsResult: ArcsByGroupResult
  connectorsByGroup: ReadonlyMap<string, GroupConnectors>
  host: {
    displayedRegions: readonly { refName: string; reversed?: boolean }[]
  }
  keyWindows: readonly KeyWindow[]
  keyReadLabels: DeclaredReadLabels
}

/** The key for the connection colors: the band's arcs and the connectors. */
export function connectionKeyViews(self: ConnectionKeyHost) {
  return {
    /**
     * #getter
     * The arc color slots plotted, mapped to legend buckets, for curved
     * arcs and the read cloud alike. Empty unless an overlay is on with
     * the legend shown.
     */
    get arcLegendCategories(): Set<ArcCategory> {
      return new Set(
        self.showLegend
          ? [...arcSlotsInWindows(self.arcsResult, self.keyWindows)].map(slot =>
              arcSlotCategory(slot),
            )
          : [],
      )
    },

    /**
     * #getter
     * Heading for the connection colors, named after what the reader is
     * looking at: flat read-cloud lines are not arcs, and with the band
     * off the colors are the pileup connectors'.
     */
    get arcLegendTitle() {
      return arcLegendTitle(self.drawnReadConnections)
    },

    /**
     * #getter
     * What the connectors drawn in view key, by the overlay's curves and
     * by the straight-line pass beside them, so the key lists every
     * connector color on screen: the class color types, and whether a
     * junction through a region not shown is drawn in its own color.
     * Empty while the legend is hidden so the scan is skipped.
     */
    get connectorKey() {
      return self.showLegend
        ? connectorKeyInWindows(
            self.connectorsByGroup,
            self.host.displayedRegions,
            self.keyWindows,
          )
        : { colorTypes: new Set<number>(), throughHidden: false }
    },

    /**
     * #getter
     * The color types (arc palette slots) the connectors drawn in view
     * paint in their class color.
     */
    get connectionColorTypes(): Set<number> {
      return this.connectorKey.colorTypes
    },

    /**
     * #method
     * Key for the connection colors drawn: the band's and the pileup
     * connectors', which paint one field through one palette, and the
     * row for a junction through a region not shown.
     */
    connectionLegendItems(palette: ColorPalette) {
      return [
        ...getArcLegendItems(
          new Set([
            ...this.arcLegendCategories,
            ...connectorCategories(this.connectionColorTypes),
          ]),
          palette,
          self.keyReadLabels.categories,
        ),
        ...throughHiddenLegendItems(this.connectorKey.throughHidden, palette),
      ]
    },
  }
}
