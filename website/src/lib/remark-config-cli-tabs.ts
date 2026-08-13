import { visit } from 'unist-util-visit'

import { deriveAddAssembly } from './derive-add-assembly.ts'
import { deriveAddTrack, deriveAddTrackJson } from './derive-add-track.ts'
import { deriveSetDefaultSession } from './derive-set-default-session.ts'

import type { Code, Root, RootContent } from 'mdast'
import type { Plugin } from 'unified'

// A ```json block tagged `addtrack` (a track config), `addassembly` (an
// assembly config) or `session` (a `defaultSession`) renders as a two-tab
// widget: "Config file" (the JSON, unchanged) and a CLI tab with the equivalent
// command, derived from that same JSON so the two can't drift. Invalid JSON
// degrades to a plain block with a build-time warning, as does an `addassembly`
// or `session` config no command can express (unlike tracks, neither has a
// verbatim-JSON fallback command).

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

export function isSession(node: Code) {
  return node.lang === 'json' && /(^|\s)session(\s|$)/.test(node.meta ?? '')
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

// Same shape as the assembly tab, and refused for the same reason: a block
// carrying more than the default session has no command that writes all of it.
function sessionCliTab(config: Record<string, unknown>, json: string) {
  const command = deriveSetDefaultSession(config, json)
  return command === null
    ? undefined
    : { label: 'CLI (set-default-session)', node: bash(command) }
}

function bash(value: string) {
  return { type: 'code', lang: 'bash', value } satisfies Code
}

// Reuses the JS-free radio-tab classes the figure recipe uses, styled in
// src/styles/widgets/spec-tabs.css — shared by both callers precisely because
// neither one's context appears in a selector there. A rule that did name one
// (`.spec-dialog …`) would reach the recipe and not this fence, which renders
// as raw radio buttons above both panels at once. Raw-HTML
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

interface TagEntry {
  tag: string
  matches: (node: Code) => boolean
  build: (
    config: Record<string, unknown>,
    json: string,
  ) => { label: string; node: Code } | undefined
  // what to say when `build` returns undefined; the track tag has no such case,
  // since add-track-json takes any track config verbatim
  refusal: string
}

// Which tag a block carries, and the derivation that tag selects.
const TAGS: TagEntry[] = [
  { tag: 'addtrack', matches: isAddtrack, build: cliTab, refusal: '' },
  {
    tag: 'addassembly',
    matches: isAddassembly,
    build: assemblyCliTab,
    refusal:
      'has no add-assembly equivalent (see derive-add-assembly.ts); leave it untagged',
  },
  {
    tag: 'session',
    matches: isSession,
    build: sessionCliTab,
    refusal:
      'is not a lone "defaultSession" (see derive-set-default-session.ts); leave it untagged',
  },
]

const remarkConfigCliTabs: Plugin<[], Root> = () => {
  return (tree, file) => {
    let widgets = 0
    visit(tree, 'code', (node: Code, index, parent) => {
      let next: number | undefined
      const entry = TAGS.find(t => t.matches(node))
      if (entry && index !== undefined && parent) {
        const config = parseConfig(node.value)
        node.meta = null
        if (config instanceof Error) {
          file.message(
            `${entry.tag} block is not valid JSON: ${config.message}`,
            node,
          )
        } else {
          const cli = entry.build(config, node.value)
          if (cli === undefined) {
            file.message(`${entry.tag} block ${entry.refusal}`, node)
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
