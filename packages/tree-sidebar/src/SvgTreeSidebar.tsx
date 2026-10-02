import { SvgBandLabels, bandLabelWidth } from './SvgBandLabels.tsx'
import { SvgRowLabels } from './SvgRowLabels.tsx'
import { SvgTreePath } from './SvgTreePath.tsx'
import { svgSidebarWidth } from './svgSidebarWidth.ts'
import { treeIsShowing, treeSidebarOffset } from './treeSidebarGeometry.ts'

import type { SvgSidebarProps } from './svgSidebarWidth.ts'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'

// The SVG-export counterpart of the on-screen `TreeSidebar`: the dendrogram,
// the band strip and the row labels, drawn left of the display's own box in the
// gutter the export reserves from `svgSidebarWidth`. Each display hands it its
// `svgSidebar` getter, so the width reserved and the sidebar drawn come from
// one set of props, measured in the export's text.
export function SvgTreeSidebar({
  sidebar,
  text,
  scrollTop,
  availableHeight,
}: {
  sidebar: SvgSidebarProps
  text?: ExportTextStyle
  scrollTop?: number
  availableHeight?: number
}) {
  const {
    showTree,
    hierarchy,
    sources,
    rowHeight,
    treeAreaWidth,
    showLabels = true,
    bands = [],
  } = sidebar
  const drawnTree = treeIsShowing({ showTree, hierarchy })
    ? hierarchy
    : undefined
  const labelOffset = treeSidebarOffset({ showTree, hierarchy, treeAreaWidth })
  return (
    <g transform={`translate(${-svgSidebarWidth(sidebar, text)} 0)`}>
      <SvgBandLabels
        bands={bands}
        rowHeight={rowHeight}
        x={labelOffset}
        scrollTop={scrollTop}
        availableHeight={availableHeight}
        text={text}
      />
      {showLabels && sources.length ? (
        <SvgRowLabels
          sources={sources}
          rowHeight={rowHeight}
          labelOffset={labelOffset + (bands.length ? bandLabelWidth(text) : 0)}
          scrollTop={scrollTop}
          availableHeight={availableHeight}
          opaque={!!drawnTree}
          text={text}
        />
      ) : null}
      {drawnTree ? (
        <SvgTreePath hierarchy={drawnTree} scrollTop={scrollTop} />
      ) : null}
    </g>
  )
}
