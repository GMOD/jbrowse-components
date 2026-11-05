import type { Code, Parent, Root, RootContent } from 'mdast'
import type { Plugin } from 'unified'

// A ```text output fence shows what the fence directly above it prints, in
// that fence's box. Read here because rehype-raw drops a fence's meta.

export const OUTPUT_CLASS = 'code-output'

export function isOutputFence(node: Code) {
  return /(^|\s)output(\s|$)/.test(node.meta ?? '')
}

export function followsCommand(prev: RootContent | undefined) {
  return prev?.type === 'code' && !isOutputFence(prev)
}

function tagOutputs(parent: Parent) {
  parent.children.forEach((child, i) => {
    if (
      child.type === 'code' &&
      isOutputFence(child) &&
      followsCommand(parent.children[i - 1])
    ) {
      child.data = { hProperties: { className: [OUTPUT_CLASS] } }
    } else if ('children' in child) {
      tagOutputs(child)
    }
  })
}

const remarkCodeOutput: Plugin<[], Root> = () => tree => {
  tagOutputs(tree)
}

export default remarkCodeOutput
