import { getText } from './hast-utils.ts'

import type { Element, Root, RootContent } from 'hast'
import type { Plugin } from 'unified'

const SECTION = 'Where the data comes from'

function shorten(url: string) {
  try {
    const { host, pathname } = new URL(url)
    const parts = pathname.split('/').filter(Boolean)
    const last = parts.at(-1)
    if (!last) {
      return host
    }
    return parts.length > 1 ? `${host}/…/${last}` : `${host}/${last}`
  } catch {
    return url
  }
}

function span(className: string, value: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: [className] },
    children: [{ type: 'text', value }],
  }
}

function isElement(node: RootContent): node is Element {
  return node.type === 'element'
}

function isH2(node: RootContent) {
  return isElement(node) && node.tagName === 'h2'
}

function bareLinks(node: Element, collapsed = false) {
  const links: { link: Element; href: string; collapsed: boolean }[] = []
  for (const child of node.children) {
    if (!isElement(child)) {
      continue
    }
    const href = child.properties.href
    if (
      child.tagName === 'a' &&
      typeof href === 'string' &&
      /^https?:\/\//.test(href) &&
      getText(child) === href
    ) {
      links.push({ link: child, href, collapsed })
    } else {
      links.push(...bareLinks(child, collapsed || child.tagName === 'details'))
    }
  }
  return links
}

// The checkbox toggles the full URLs by CSS alone (`~` siblings), with no script
const rehypeDataUrls: Plugin<[], Root> = () => (tree, file) => {
  if (file.data.feed === true) {
    return
  }
  const { children } = tree
  const start = children.findIndex(
    node => isH2(node) && getText(node).trim() === SECTION,
  )
  if (start < 0) {
    return
  }
  let end = start + 1
  while (end < children.length && !isH2(children[end]!)) {
    end++
  }
  const section: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['data-urls'] },
    children: children.slice(start + 1, end) as Element['children'],
  }
  const links = bareLinks(section)
  if (links.every(l => l.collapsed)) {
    return
  }
  for (const { link, href } of links) {
    link.children = [span('url-short', shorten(href)), span('url-full', href)]
  }
  const toggle: Element[] = [
    {
      type: 'element',
      tagName: 'input',
      properties: {
        type: 'checkbox',
        id: 'show-full-urls',
        className: ['data-urls-toggle'],
      },
      children: [],
    },
    {
      type: 'element',
      tagName: 'label',
      properties: { htmlFor: ['show-full-urls'], className: ['data-urls-label'] },
      children: [{ type: 'text', value: 'Show full URLs' }],
    },
  ]
  children.splice(start + 1, end - start - 1, ...toggle, section)
}

export default rehypeDataUrls
