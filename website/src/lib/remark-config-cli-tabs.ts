import { visit } from 'unist-util-visit'

import { deriveAddAssembly } from './derive-add-assembly.ts'
import { deriveAddTrack, deriveAddTrackJson } from './derive-add-track.ts'
import { deriveSessionUrl } from './derive-session-url.ts'
import { deriveSetDefaultSession } from './derive-set-default-session.ts'

import type { Code, Root, RootContent } from 'mdast'
import type { Plugin } from 'unified'

// A ```json block tagged `addtrack` (a track config), `addassembly` (an
// assembly config) or `session` (a `defaultSession`) renders as a tabbed
// widget: "Config file" (the JSON, unchanged) beside every other way to apply
// the same thing, each derived from that same JSON so they can't drift. A
// `session` fence carrying `config=<url>` gets a third tab, a live link.
// Invalid JSON degrades to a plain block with a build-time warning, as does an
// `addassembly` or `session` config no command can express (unlike tracks,
// neither has a verbatim-JSON fallback command).

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

// A link rather than the URL as text. A session URL runs to hundreds of
// characters once its JSON is percent-encoded, so printing it teaches nothing
// the other two tabs don't and buries the one thing this tab is for, which is
// that the session can be opened right now. `&` has to be escaped here or the
// browser reads `&session=…` as an entity and drops the session.
function urlTab(url: string): Tab {
  return {
    label: 'URL',
    node: raw(
      `<p><a href="${url.replaceAll('&', '&amp;')}" target="_blank" rel="noopener">` +
        `Open this session in JBrowse</a></p>`,
    ),
  }
}

// Reuses the JS-free radio-tab classes the figure recipe uses, styled in
// src/styles/widgets/spec-tabs.css — shared by both callers precisely because
// neither one's context appears in a selector there. A rule that did name one
// (`.spec-dialog …`) would reach the recipe and not this fence, which renders
// as raw radio buttons above every panel at once. Raw-HTML wrappers interleave
// with real mdast code nodes so each panel still gets Shiki highlighting
// downstream. `gid` names one radio group and must be unique within the page:
// two widgets sharing a group leave the first showing no panel at all, because
// picking a tab in the second unchecks both of its inputs.
//
// Every input precedes every panel, which the stylesheet's `~` selectors
// require. It pairs the nth input with `.spec-panel-n` and stops at 6, so a
// widget cannot grow past that without a rule there.
function tabWidget(gid: string, tabs: Tab[]) {
  const inputs = tabs.map(
    ({ label }, i) =>
      `<input class="spec-tab-input" type="radio" name="${gid}" id="${gid}-${i}"${
        i === 0 ? ' checked' : ''
      }/>\n<label class="spec-tab-label" for="${gid}-${i}">${label}</label>`,
  )
  return [
    raw(
      `<div class="spec-tabs config-cli-tabs">\n${inputs.join('\n')}\n` +
        `<div class="spec-panel spec-panel-1">`,
    ),
    tabs[0]!.node,
    ...tabs
      .slice(1)
      .flatMap(({ node }, i) => [
        raw(`</div>\n<div class="spec-panel spec-panel-${i + 2}">`),
        node,
      ]),
    raw(`</div>\n</div>`),
  ]
}

interface Tab {
  label: string
  node: RootContent
}

interface TagEntry {
  tag: string
  matches: (node: Code) => boolean
  // the tabs that follow "Config file". Undefined means this tag has no way to
  // apply this config, which the caller reports using the same entry's
  // `refusal`; an entry that always has one (addtrack, via add-track-json)
  // leaves refusal empty.
  build: (
    config: Record<string, unknown>,
    json: string,
    meta: string | null | undefined,
  ) => Tab[] | undefined
  refusal: string
}

// Which tag a block carries, and the derivations that tag selects.
const TAGS: TagEntry[] = [
  {
    tag: 'addtrack',
    matches: isAddtrack,
    build: (config, json) => [cliTab(config, json)],
    refusal: '',
  },
  {
    tag: 'addassembly',
    matches: isAddassembly,
    build: config => {
      const tab = assemblyCliTab(config)
      return tab && [tab]
    },
    refusal:
      'has no add-assembly equivalent (see derive-add-assembly.ts); leave it untagged',
  },
  {
    tag: 'session',
    matches: isSession,
    // the live link is opt-in (`config=<url>` in the meta) and simply absent
    // otherwise, rather than a refusal: a session with no hosted config is the
    // normal case for an illustrative block, and the CLI tab still applies.
    build: (config, json, meta) => {
      const cli = sessionCliTab(config, json)
      const url = deriveSessionUrl(config, meta)
      return cli && [cli, ...(url ? [urlTab(url)] : [])]
    },
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
        // read before it is cleared: the meta carries the tag AND, for a
        // session fence, the `config=` its live link is built from
        const meta = node.meta
        node.meta = null
        if (config instanceof Error) {
          file.message(
            `${entry.tag} block is not valid JSON: ${config.message}`,
            node,
          )
        } else {
          const tabs = entry.build(config, node.value, meta)
          if (tabs === undefined) {
            file.message(`${entry.tag} block ${entry.refusal}`, node)
          } else {
            const nodes = tabWidget(`cfgtab-${(widgets += 1)}`, [
              { label: 'Config file', node },
              ...tabs,
            ])
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
