import { visit } from 'unist-util-visit'

import { retargetCodeBase } from './code-base.ts'

import type { Link, Root } from 'mdast'
import type { Plugin } from 'unified'

// Retarget hand-written "Live demo" links at the configured JBrowse build (see
// code-base.ts), so a staged page's prose links open the same app its generated
// figure links do. Only real link nodes are touched — a URL quoted in prose or a
// code fence (urlparams.md's examples) stays exactly as written.
const remarkCodeBase: Plugin<[], Root> = () => {
  return tree => {
    visit(tree, 'link', (node: Link) => {
      node.url = retargetCodeBase(node.url)
    })
  }
}

export default remarkCodeBase
