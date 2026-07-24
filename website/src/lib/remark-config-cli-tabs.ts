import { visit } from 'unist-util-visit'

import { deriveAddTrack } from './derive-add-track.ts'

import type { Code, Root, RootContent } from 'mdast'
import type { Plugin } from 'unified'

// A ```json block tagged `addtrack` in its info string is a track config that
// should render as a two-tab widget: "Config file" (the JSON, unchanged) and
// "CLI (add-track)" (the equivalent command, derived from that same JSON so the
// two can't drift). The CLI command comes from deriveAddTrack; a block whose
// config isn't CLI-clean (deriveAddTrack returns null) degrades to a plain JSON
// block with a build-time warning, so the tag is never silently wrong.
//
// The markup reuses the JS-free radio-tab classes already styled in
// DocsLayout.astro (.spec-tabs / .spec-tab-input / .spec-panel-N). Raw-HTML
// wrappers interleave with real mdast code nodes so both panels still get Shiki
// highlighting downstream.

function raw(value: string): RootContent {
  return { type: 'html', value }
}

const remarkConfigCliTabs: Plugin<[], Root> = () => {
  return (tree, file) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      const tagged =
        node.lang === 'json' && /(^|\s)addtrack(\s|$)/.test(node.meta ?? '')
      if (tagged && index !== undefined && parent) {
        let command: string | null = null
        try {
          command = deriveAddTrack(JSON.parse(node.value))
        } catch (e) {
          file.message(
            `addtrack block is not valid JSON: ${(e as Error).message}`,
            node,
          )
        }
        node.meta = null
        if (command === null) {
          file.message(
            'addtrack block is not CLI-clean (extra adapter slots, custom ' +
              'displays, or a multi-file adapter); rendering plain JSON',
            node,
          )
        } else {
          const gid = `cfgtab-${JSON.parse(node.value).trackId}`
          const cli: Code = { type: 'code', lang: 'bash', value: command }
          parent.children.splice(
            index,
            1,
            raw(
              `<div class="spec-tabs config-cli-tabs">\n` +
                `<input class="spec-tab-input" type="radio" name="${gid}" id="${gid}-cfg" checked/>\n` +
                `<label class="spec-tab-label" for="${gid}-cfg">Config file</label>\n` +
                `<input class="spec-tab-input" type="radio" name="${gid}" id="${gid}-cli"/>\n` +
                `<label class="spec-tab-label" for="${gid}-cli">CLI (add-track)</label>\n` +
                `<div class="spec-panel spec-panel-1">`,
            ),
            node,
            raw(`</div>\n<div class="spec-panel spec-panel-2">`),
            cli,
            raw(`</div>\n</div>`),
          )
        }
      }
    })
  }
}

export default remarkConfigCliTabs
