export interface HierarchyNode<T> {
  data: T
  children: HierarchyNode<T>[] | null
  parent: HierarchyNode<T> | null
  depth: number
  height: number
  value?: number
  x?: number
  y?: number
  // position derived from cumulative branch lengths (see setBrLength)
  len?: number
}

export interface PositionedHierarchyNode<T> extends HierarchyNode<T> {
  x: number
  y: number
  children: PositionedHierarchyNode<T>[] | null
  parent: PositionedHierarchyNode<T> | null
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
    let h = 0
    for (const child of node.children) {
      h = Math.max(h, child.height + 1)
    }
    node.height = h
  }
  return node
}

export function hierarchy<T>(
  data: T,
  childrenAccessor: (d: T) => T[] | undefined | null,
): HierarchyNode<T> {
  return wrap(data, childrenAccessor, null, 0)
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
  eachAfter(root, node => {
    if (node.children) {
      let totalX = 0
      for (const child of node.children) {
        totalX += child.x!
      }
      node.x = totalX / node.children.length
    }
  })
  assignDepthY(root, sizeY)
  return root as unknown as PositionedHierarchyNode<T>
}

// Post-order traversal (children visited before their parent)
export function eachAfter<T>(
  node: HierarchyNode<T>,
  fn: (n: HierarchyNode<T>) => void,
) {
  if (node.children) {
    for (const child of node.children) {
      eachAfter(child, fn)
    }
  }
  fn(node)
}

// Assigns y positions based on depth — root at 0, leaves at sizeY
export function assignDepthY<T>(node: HierarchyNode<T>, sizeY: number) {
  const rootHeight = node.height
  function visit(n: HierarchyNode<T>, depth: number) {
    n.y = rootHeight === 0 ? sizeY : (depth / rootHeight) * sizeY
    if (n.children) {
      for (const child of n.children) {
        visit(child, depth + 1)
      }
    }
  }
  visit(node, 0)
}

// Largest root-to-leaf cumulative branch length
export function maxLength<T extends { length?: number }>(
  d: HierarchyNode<T>,
): number {
  return (
    (d.data.length ?? 0) +
    (d.children ? d.children.reduce((m, c) => Math.max(m, maxLength(c)), 0) : 0)
  )
}

// Assigns `len` (x position scaled by `k`) from cumulative branch lengths
export function setBrLength<T extends { length?: number }>(
  d: HierarchyNode<T>,
  y0: number,
  k: number,
) {
  const newY0 = y0 + Math.max(d.data.length ?? 0, 0)
  d.len = newY0 * k
  if (d.children) {
    for (const child of d.children) {
      setBrLength(child, newY0, k)
    }
  }
}

// Single post-order pass building a Map from every node to the array of
// leaf names below it. Useful when callers need leaf names for many nodes —
// repeated `getLeafNames(node)` calls are O(n²) over a tree.
export function leafNameMap<T extends { name?: string }>(
  root: HierarchyNode<T>,
): Map<HierarchyNode<T>, string[]> {
  const map = new Map<HierarchyNode<T>, string[]>()
  function visit(node: HierarchyNode<T>): string[] {
    if (!node.children?.length) {
      const names = node.data.name === undefined ? [] : [node.data.name]
      map.set(node, names)
      return names
    }
    const names: string[] = []
    for (const child of node.children) {
      for (const name of visit(child)) {
        names.push(name)
      }
    }
    map.set(node, names)
    return names
  }
  visit(root)
  return map
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
