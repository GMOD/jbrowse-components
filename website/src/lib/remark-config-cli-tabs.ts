import { visit } from 'unist-util-visit'

import { deriveAddAssembly } from './derive-add-assembly.ts'
import { deriveAddTrack, deriveAddTrackJson } from './derive-add-track.ts'

import type { Code, Root, RootContent } from 'mdast'
import type { Plugin } from 'unified'

// A ```json block tagged `addtrack` (a track config) or `addassembly` (an
// assembly config) renders as a two-tab widget: "Config file" (the JSON,
// unchanged) and a CLI tab with the equivalent command, derived from that same
// JSON so the two can't drift. Invalid JSON degrades to a plain block with a
// build-time warning, as does an `addassembly` config no command can express
// (unlike tracks, assemblies have no verbatim-JSON fallback command).

function raw(value: string): RootContent {
  return { type: 'html', value }
}

// Exported so scripts/check-config-cli.ts selects exactly the blocks this
// renders — it used to re-detect them with its own column-0 fence regex, which
// would silently skip an indented fence and read as a pass.
export function isAddtrack(node: Code) {
  return node.lang === 'json' && /(^|\s)addtrack(\s|$)/.test(node.meta ?? '')
}

export function isAddassembly(node: Code) {
  return node.lang === 'json' && /(^|\s)addassembly(\s|$)/.test(node.meta ?? '')
}

function parseConfig(json: string) {
  try {
    return JSON.parse(json) as Record<string, unknown>
  } catch (e) {
    return e as Error
  }
}

// deriveAddTrack handles the common single-file-adapter case as flags; a config
// it refuses (multi-file adapter, custom `displays`, ...) falls back to
// deriveAddTrackJson, which embeds the config verbatim and so never refuses.
function cliTab(config: Record<string, unknown>, json: string) {
  const command = deriveAddTrack(config)
  return {
    label: command === null ? 'CLI (add-track-json)' : 'CLI (add-track)',
    node: bash(command ?? deriveAddTrackJson(json)),
  }
}

// An assembly has no verbatim-JSON command to fall back on, so a config
// deriveAddAssembly refuses gets no widget at all (the caller warns).
function assemblyCliTab(config: Record<string, unknown>) {
  const command = deriveAddAssembly(config)
  return command === null
    ? undefined
    : { label: 'CLI (add-assembly)', node: bash(command) }
}

function bash(value: string) {
  return { type: 'code', lang: 'bash', value } satisfies Code
}

// Reuses the JS-free radio-tab classes styled in DocsLayout.astro. Raw-HTML
// wrappers interleave with real mdast code nodes so both panels still get Shiki
// highlighting downstream. `gid` names one radio group and must be unique
// within the page: two widgets sharing a group leave the first showing no panel
// at all, because picking a tab in the second unchecks both of its inputs.
function tabWidget(gid: string, cliLabel: string, cfg: Code, cli: Code) {
  return [
    raw(
      `<div class="spec-tabs config-cli-tabs">\n` +
        `<input class="spec-tab-input" type="radio" name="${gid}" id="${gid}-cfg" checked/>\n` +
        `<label class="spec-tab-label" for="${gid}-cfg">Config file</label>\n` +
        `<input class="spec-tab-input" type="radio" name="${gid}" id="${gid}-cli"/>\n` +
        `<label class="spec-tab-label" for="${gid}-cli">${cliLabel}</label>\n` +
        `<div class="spec-panel spec-panel-1">`,
    ),
    cfg,
    raw(`</div>\n<div class="spec-panel spec-panel-2">`),
    cli,
    raw(`</div>\n</div>`),
  ]
}

const remarkConfigCliTabs: Plugin<[], Root> = () => {
  return (tree, file) => {
    let widgets = 0
    visit(tree, 'code', (node: Code, index, parent) => {
      let next: number | undefined
      const assembly = isAddassembly(node)
      if ((isAddtrack(node) || assembly) && index !== undefined && parent) {
        const tag = assembly ? 'addassembly' : 'addtrack'
        const config = parseConfig(node.value)
        node.meta = null
        if (config instanceof Error) {
          file.message(
            `${tag} block is not valid JSON: ${config.message}`,
            node,
          )
        } else {
          const cli = assembly
            ? assemblyCliTab(config)
            : cliTab(config, node.value)
          if (cli === undefined) {
            file.message(
              'addassembly block has no add-assembly equivalent (see derive-add-assembly.ts); leave it untagged',
              node,
            )
          } else {
            const nodes = tabWidget(
              `cfgtab-${(widgets += 1)}`,
              cli.label,
              node,
              cli.node,
            )
            parent.children.splice(index, 1, ...nodes)
            // resume past the splice, else visit walks back onto the code node
            next = index + nodes.length
          }
        }
      }
      return next
    })
  }
}

export default remarkConfigCliTabs
