import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'

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
// one set of props, measured in the export's text. Given the rows' viewport
// (`availableHeight`), it clips to it as the screen does, so a row scrolled
// above the first one draws nothing over the bands above the rows; `clipId`
// names that clip, the display's `svgNodeId`, so two exports of one display
// match byte for byte.
export function SvgTreeSidebar({
  sidebar,
  text,
  scrollTop,
  availableHeight,
  clipId,
}: {
  sidebar: SvgSidebarProps
  text?: ExportTextStyle
  scrollTop?: number
} & (
  | { availableHeight?: undefined; clipId?: undefined }
  | { availableHeight: number; clipId: string }
)) {
  const {
    showTree,
    hierarchy,
    sources,
    rowHeight,
    treeAreaWidth,
    showLabels = true,
    bands = [],
    annotations,
  } = sidebar
  const drawnTree = treeIsShowing({ showTree, hierarchy })
    ? hierarchy
    : undefined
  const labelOffset = treeSidebarOffset({ showTree, hierarchy, treeAreaWidth })
  const width = svgSidebarWidth(sidebar, text)
  const content = (
    <>
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
          text={text}
          annotations={annotations}
        />
      ) : null}
      {drawnTree ? (
        <SvgTreePath hierarchy={drawnTree} scrollTop={scrollTop} />
      ) : null}
    </>
  )
  return (
    <g transform={`translate(${-width} 0)`}>
      {availableHeight === undefined ? (
        content
      ) : (
        <SvgClipRect
          id={`tree-sidebar-${clipId}`}
          width={width}
          height={availableHeight}
        >
          {content}
        </SvgClipRect>
      )}
    </g>
  )
}
