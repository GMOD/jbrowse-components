export interface TreeSidebarModel {
  totalHeight: number
  hierarchy?: any
  treeAreaWidth: number
  height: number
  scrollTop: number
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: { node: any; descendantNames: string[] }) => void
  setTreeAreaWidth: (width: number) => void
}
