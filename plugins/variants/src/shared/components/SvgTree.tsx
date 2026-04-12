import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

const SvgTree = ({
  hierarchy,
  scrollTop,
}: {
  hierarchy: ClusterHierarchyNode
  scrollTop: number
}) => {
  let treePaths = ''
  for (const link of hierarchy.links()) {
    const sx = link.source.y!
    const sy = link.source.x!
    const tx = link.target.y!
    const ty = link.target.x!
    treePaths += `M${sx},${sy}L${sx},${ty}M${sx},${ty}L${tx},${ty}`
  }
  return (
    <g transform={`translate(0 ${-scrollTop})`}>
      <path d={treePaths} fill="none" stroke="#0008" strokeWidth={1} />
    </g>
  )
}

export default SvgTree
