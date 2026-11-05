import { leftAxisGutterWidth } from '@jbrowse/display-ui/axisPlacement'
import { sidebarPanelWidth } from '@jbrowse/tree-sidebar'

import { getRowTop } from './wiggleComponentUtils.ts'

import type { WigglePlotGeometry } from './wiggleDisplayViews.ts'
import type {
  ClusterHierarchyNode,
  RowLabelSource,
  SvgSidebarProps,
} from '@jbrowse/tree-sidebar'
import type { ValueScale, YAxis } from '@jbrowse/wiggle-core'

/** What {@link wiggleRowLabelViews} reads: the rows and the sidebar toggle. */
export interface WiggleRowLabelHost {
  numSources: number
  isRowLayout: boolean
  showRowLabels: boolean
}

/** Whether a wiggle display names its rows. */
export function wiggleRowLabelViews(self: WiggleRowLabelHost) {
  return {
    /**
     * #getter
     * Overlay draws every source on one row, so it names none.
     */
    get drawsRowLabels() {
      return self.numSources > 1 && self.isRowLayout && self.showRowLabels
    },
  }
}

/** What {@link wiggleSidebarViews} reads: the rows and the tree beside them. */
export interface WiggleSidebarHost {
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
  treeAreaWidth: number
  sources: RowLabelSource[]
  effectiveRowHeight: number
  drawsRowLabels: boolean
}

/** The sidebar a wiggle display draws left of its plot. */
export function wiggleSidebarViews(self: WiggleSidebarHost) {
  return {
    /**
     * #getter
     * The dendrogram and row labels at the display's left, which the axis
     * sits past on screen and the export parks left of the figure.
     */
    get sidebarPanel(): SvgSidebarProps {
      return {
        showTree: self.showTree,
        hierarchy: self.hierarchy,
        sources: self.sources,
        rowHeight: self.effectiveRowHeight,
        treeAreaWidth: self.treeAreaWidth,
        showLabels: self.drawsRowLabels,
      }
    },
  }
}

/** What {@link wiggleAxisViews} reads: the rows, the sidebar and the y scale. */
export interface WiggleAxisHost {
  sidebarPanel: SvgSidebarProps
  effectiveRowHeight: number
  rowsTopOffset: number
  plotGeometry: WigglePlotGeometry
  scoreRampReplacesAxis: boolean
  isDensityMode: boolean
  domain: [number, number] | undefined
  scaleType: string
  symlogConstant: number
  axisGuide: Pick<ValueScale, 'caption' | 'rules' | 'grid' | 'showAxis'>
  axes: YAxis[]
}

/**
 * The y scale a wiggle display rules its rows by, and the sidebar the export
 * parks left of the plot.
 */
export function wiggleAxisViews(self: WiggleAxisHost) {
  return {
    /**
     * #getter
     * The one scale every row shares, ruling a band per row stacked down the
     * track, past the dendrogram where one is shown. Density rows, one
     * color per row, map the scale to color rather than to y, so they
     * rule no band and the chrome captions the domain instead; under the
     * one ramp the ramp is the key and shows the domain itself.
     */
    get valueScales(): ValueScale[] {
      if (self.scoreRampReplacesAxis) {
        return []
      }
      const { tickHeight, yTop, numRows } = self.plotGeometry
      return [
        {
          domain: self.domain,
          scaleType: self.scaleType,
          height: tickHeight,
          offset: yTop - self.rowsTopOffset,
          symlogConstant: self.symlogConstant,
          bandTops: self.isDensityMode
            ? []
            : Array.from(
                { length: numRows },
                (_, row) =>
                  self.rowsTopOffset + getRowTop(row, self.effectiveRowHeight),
              ),
          left: sidebarPanelWidth(self.sidebarPanel),
          ...self.axisGuide,
        },
      ]
    },

    /**
     * #getter
     */
    get svgSidebar(): SvgSidebarProps {
      return {
        ...self.sidebarPanel,
        leftInset: leftAxisGutterWidth(self.axes),
      }
    },
  }
}
