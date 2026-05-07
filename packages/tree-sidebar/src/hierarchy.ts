export interface HierarchyNode<T> {
  data: T
  children: HierarchyNode<T>[] | null
  parent: HierarchyNode<T> | null
  depth: number
  height: number
  value?: number
  x?: number
  y?: number
}

export interface PositionedHierarchyNode<T> extends HierarchyNode<T> {
  x: number
  y: number
  children: PositionedHierarchyNode<T>[] | null
  parent: PositionedHierarchyNode<T> | null
}

function computeHeight<T>(node: HierarchyNode<T>): number {
  let h = 0
  if (node.children) {
    for (const child of node.children) {
      h = Math.max(h, computeHeight(child) + 1)
    }
  }
  node.height = h
  return h
}

function wrap<T>(
  data: T,
  childrenAccessor: (d: T) => T[] | undefined | null,
  parent: HierarchyNode<T> | null,
  depth: number,
): HierarchyNode<T> {
  const kids = childrenAccessor(data)
  const node: HierarchyNode<T> = {
    data,
    children: null,
    parent,
    depth,
    height: 0,
  }
  if (kids?.length) {
    node.children = kids.map(d => wrap(d, childrenAccessor, node, depth + 1))
  }
  return node
}

export function hierarchy<T>(
  data: T,
  childrenAccessor: (d: T) => T[] | undefined | null,
): HierarchyNode<T> {
  const root = wrap(data, childrenAccessor, null, 0)
  computeHeight(root)
  return root
}

export function sum<T>(
  node: HierarchyNode<T>,
  valueFn: (d: T) => number,
): HierarchyNode<T> {
  function visit(n: HierarchyNode<T>): number {
    let s = valueFn(n.data)
    if (n.children) {
      for (const child of n.children) {
        s += visit(child)
      }
    }
    n.value = s
    return s
  }
  visit(node)
  return node
}

export function sort<T>(
  node: HierarchyNode<T>,
  compareFn: (a: HierarchyNode<T>, b: HierarchyNode<T>) => number,
): HierarchyNode<T> {
  function visit(n: HierarchyNode<T>) {
    if (n.children) {
      n.children.sort(compareFn)
      for (const child of n.children) {
        visit(child)
      }
    }
  }
  visit(node)
  return node
}

export function leaves<N extends { children: N[] | null }>(node: N): N[] {
  const result: N[] = []
  function visit(n: N) {
    if (n.children) {
      for (const child of n.children) {
        visit(child)
      }
    } else {
      result.push(n)
    }
  }
  visit(node)
  return result
}

export function descendants<N extends { children: N[] | null }>(node: N): N[] {
  const result: N[] = []
  function visit(n: N) {
    result.push(n)
    if (n.children) {
      for (const child of n.children) {
        visit(child)
      }
    }
  }
  visit(node)
  return result
}

export function links<N extends { children: N[] | null }>(
  node: N,
): { source: N; target: N }[] {
  const result: { source: N; target: N }[] = []
  function visit(n: N) {
    if (n.children) {
      for (const child of n.children) {
        result.push({ source: n, target: child })
        visit(child)
      }
    }
  }
  visit(node)
  return result
}

export function clusterLayout<T>(
  root: HierarchyNode<T>,
  sizeX: number,
  sizeY: number,
): PositionedHierarchyNode<T> {
  const leafNodes = leaves(root)
  const n = leafNodes.length
  const step = n > 0 ? sizeX / n : 0

  for (let i = 0; i < n; i++) {
    leafNodes[i]!.x = (i + 0.5) * step
  }

  function assignX(node: HierarchyNode<T>) {
    if (!node.children) {
      return
    }
    let totalX = 0
    for (const child of node.children) {
      assignX(child)
      totalX += child.x!
    }
    node.x = totalX / node.children.length
  }
  assignX(root)

  const rootHeight = root.height
  function assignY(node: HierarchyNode<T>, depth: number) {
    node.y = rootHeight === 0 ? sizeY : (depth / rootHeight) * sizeY
    if (node.children) {
      for (const child of node.children) {
        assignY(child, depth + 1)
      }
    }
  }
  assignY(root, 0)
  return root as unknown as PositionedHierarchyNode<T>
}

export function renderTreeSVG<T>(hierarchy: PositionedHierarchyNode<T>) {
  const parts: string[] = []
  for (const link of links(hierarchy)) {
    const sx = link.source.y
    const sy = link.source.x
    const tx = link.target.y
    const ty = link.target.x
    parts.push(`M${sx},${sy}L${sx},${ty}M${sx},${ty}L${tx},${ty}`)
  }
  return parts.join('')
}
