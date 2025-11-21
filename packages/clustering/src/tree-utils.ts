import type { ClusterNode } from './types.js'

export function printTree(
  node: ClusterNode,
  indent = '',
  isLast = true,
): string {
  const prefix = indent + (isLast ? '└── ' : '├── ')
  let output = `${prefix}${node.name} h=${node.height.toFixed(2)}\n`

  if (node.children) {
    const newIndent = indent + (isLast ? '    ' : '│   ')
    for (let i = 0; i < node.children.length; i++) {
      const isLastChild = i === node.children.length - 1
      output += printTree(node.children[i]!, newIndent, isLastChild)
    }
  }

  return output
}

export function toNewick(node: ClusterNode): string {
  if (!node.children || node.children.length === 0) {
    return node.name
  }

  const childStrings = node.children.map(child => toNewick(child))
  return `(${childStrings.join(',')})${node.height.toFixed(4)}`
}

export function treeToJSON(node: ClusterNode) {
  const result: {
    name: string
    height: number
    children?: ReturnType<typeof treeToJSON>[]
  } = {
    name: node.name,
    height: node.height,
  }

  if (node.children && node.children.length > 0) {
    result.children = node.children.map(child => treeToJSON(child))
  }

  return result
}
