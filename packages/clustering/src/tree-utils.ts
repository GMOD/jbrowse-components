import type { ClusterNode } from './types.js'

export function printTree(
  node: ClusterNode,
  sampleLabels: string[] | null = null,
  indent = '',
  isLast = true,
): string {
  const prefix = indent + (isLast ? '└── ' : '├── ')
  const labels = node.indexes
    .map(i => sampleLabels?.[i] ?? `S${i}`)
    .join(', ')

  let output = `${prefix}[${labels}] h=${node.height.toFixed(2)}\n`

  if (node.children) {
    const newIndent = indent + (isLast ? '    ' : '│   ')
    for (let i = 0; i < node.children.length; i++) {
      const isLastChild = i === node.children.length - 1
      output += printTree(
        node.children[i]!,
        sampleLabels,
        newIndent,
        isLastChild,
      )
    }
  }

  return output
}

export function toNewick(
  node: ClusterNode,
  sampleLabels: string[] | null = null,
): string {
  if (!node.children || node.children.length === 0) {
    const label = sampleLabels?.[node.indexes[0]!] ?? `S${node.indexes[0]}`
    return label
  }

  const childStrings = node.children.map(child =>
    toNewick(child, sampleLabels),
  )
  return `(${childStrings.join(',')})${node.height.toFixed(4)}`
}

export function treeToJSON(
  node: ClusterNode,
  sampleLabels: string[] | null = null,
) {
  const labels = node.indexes.map(i => sampleLabels?.[i] ?? `S${i}`)

  const result: {
    indexes: number[]
    labels: string[]
    height: number
    children?: ReturnType<typeof treeToJSON>[]
  } = {
    indexes: node.indexes,
    labels: labels,
    height: node.height,
  }

  if (node.children && node.children.length > 0) {
    result.children = node.children.map(child =>
      treeToJSON(child, sampleLabels),
    )
  }

  return result
}
