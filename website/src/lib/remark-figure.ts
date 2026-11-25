import { visit } from 'unist-util-visit'

import { figureRe, figureRenderer } from './figure-html.ts'

import type { Root } from 'mdast'
import type { Plugin } from 'unified'

const remarkFigure: Plugin<[], Root> = () => {
  return (tree, file) => {
    const figureFor = figureRenderer(file.data.feed === true)
    visit(tree, 'html', node => {
      node.value = node.value.replaceAll(figureRe, (_match, attrList: string) =>
        figureFor(attrList),
      )
    })
  }
}

export default remarkFigure
