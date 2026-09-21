import { bundledLanguages, createHighlighter } from 'shiki'
import { visit } from 'unist-util-visit'

import { getText } from './hast-utils.ts'

import type { Element, Root } from 'hast'
import type { BundledLanguage, Highlighter } from 'shiki'
import type { Plugin } from 'unified'

// catppuccin-mocha's base/text are the site's --color-code-bg/--color-code-text
const THEME = 'catppuccin-mocha'

// Shiki bundles no Slang grammar; Slang is HLSL with extensions.
const LANG_ALIASES: Record<string, BundledLanguage> = {
  slang: 'hlsl',
}

function isBundledLanguage(lang: string): lang is BundledLanguage {
  return Object.hasOwn(bundledLanguages, lang)
}

export function resolveLang(label = '') {
  const lang = LANG_ALIASES[label] ?? label
  return isBundledLanguage(lang) ? lang : undefined
}

let highlighterPromise: Promise<Highlighter> | undefined
function getHighlighter() {
  highlighterPromise ??= createHighlighter({ themes: [THEME], langs: [] })
  return highlighterPromise
}

function codeLang(code: Element) {
  const className = code.properties.className
  const classes = Array.isArray(className) ? className : []
  const match = classes
    .map(c => /^language-(.+)$/.exec(String(c)))
    .find(Boolean)
  return match?.[1]
}

function codeBlock(node: Element) {
  const code = node.children[0]
  return node.tagName === 'pre' &&
    code?.type === 'element' &&
    code.tagName === 'code'
    ? code
    : undefined
}

function isCopyWrap(node: Root | Element) {
  const className = node.type === 'element' ? node.properties.className : []
  return Array.isArray(className) && className.includes('code-copywrap')
}

function copyWrap(pre: Element): Element {
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-copywrap'] },
    children: [
      {
        type: 'element',
        tagName: 'button',
        properties: { type: 'button', className: ['code-copy'] },
        children: [{ type: 'text', value: 'Copy' }],
      },
      pre,
    ],
  }
}

const rehypeShiki: Plugin<[], Root> = () => {
  return async tree => {
    const langs = new Set<BundledLanguage>()
    visit(tree, 'element', node => {
      const code = codeBlock(node)
      const lang = code && resolveLang(codeLang(code))
      if (lang) {
        langs.add(lang)
      }
    })
    const highlighter = await getHighlighter()
    await highlighter.loadLanguage(...langs)
    visit(tree, 'element', (node, index, parent) => {
      const code = codeBlock(node)
      if (code && parent && index !== undefined) {
        const highlighted = highlighter.codeToHast(
          getText(code).replace(/\n$/, ''),
          { lang: resolveLang(codeLang(code)) ?? 'text', theme: THEME },
        )
        const pre = highlighted.children[0]
        if (pre?.type === 'element') {
          parent.children[index] = isCopyWrap(parent) ? pre : copyWrap(pre)
        }
      }
    })
  }
}

export default rehypeShiki
