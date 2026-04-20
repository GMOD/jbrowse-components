import { type ClusterHierarchyNode, renderTreeSVG } from '@jbrowse/tree-sidebar'

const SvgTree = ({
  hierarchy,
  scrollTop,
}: {
  hierarchy: ClusterHierarchyNode
  scrollTop: number
}) => {
  return (
    <g transform={`translate(0 ${-scrollTop})`}>
      <path
        d={renderTreeSVG(hierarchy)}
        fill="none"
        stroke="#0008"
        strokeWidth={1}
      />
    </g>
  )
}

export default SvgTree
