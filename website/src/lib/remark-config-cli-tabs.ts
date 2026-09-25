import { deriveAddAssembly } from './derive-add-assembly.ts'
import { deriveAddTrack, deriveAddTrackJson } from './derive-add-track.ts'
import {
  desktopAssemblyNodes,
  desktopTrackNodes,
} from './derive-desktop-steps.ts'
import { deriveSessionUrl } from './derive-session-url.ts'
import { deriveSetDefaultSession } from './derive-set-default-session.ts'
import { deriveTrackLinks } from './derive-track-url.ts'
import { escapeAttr } from './inline-html.ts'
import { DESKTOP_LINK_MIN_VERSION } from './spec-recipe/html.ts'

import type {
  Code,
  Paragraph,
  Parent,
  PhrasingContent,
  Root,
  RootContent,
} from 'mdast'
import type { Plugin } from 'unified'

// A ```json block tagged `addtrack` (a track config), `addassembly` (an
// assembly config) or `session` (a `defaultSession`) renders as a tabbed
// widget: "Config file" (the JSON, unchanged) beside every other way to apply
// the same thing, each derived from that same JSON so they can't drift. The tab
// strip is what routes a reader who owns no config.json — a Desktop user's only
// route is the GUI one, and a page that names it in prose instead leaves a
// stray JSON block under a paragraph they cannot act on. A `session` or
// `addtrack` fence carrying `config=<url>` gets a live-link tab.
// Invalid JSON degrades to a plain block with a build-time warning, as does an
// `addassembly` or `session` config no command can express (unlike tracks,
// neither has a verbatim-JSON fallback command).
//
// Each radio input carries `data-tab-kind`, which TabMemory.astro matches to
// check the same kind of tab in every widget once a reader picks one.

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
function cliTab(config: Record<string, unknown>, json: string): Tab {
  const command = deriveAddTrack(config)
  return {
    kind: 'cli',
    label: command === null ? 'CLI (add-track-json)' : 'CLI (add-track)',
    nodes: [bash(command ?? deriveAddTrackJson(json))],
  }
}

// An assembly has no verbatim-JSON command to fall back on, so a config
// deriveAddAssembly refuses gets no widget at all (the caller warns).
function assemblyCliTab(config: Record<string, unknown>): Tab | undefined {
  const command = deriveAddAssembly(config)
  return command === null
    ? undefined
    : { kind: 'cli', label: 'CLI (add-assembly)', nodes: [bash(command)] }
}

// Same shape as the assembly tab, and refused for the same reason: a block
// carrying more than the default session has no command that writes all of it.
function sessionCliTab(
  config: Record<string, unknown>,
  json: string,
): Tab | undefined {
  const command = deriveSetDefaultSession(config, json)
  return command === null
    ? undefined
    : { kind: 'cli', label: 'CLI (set-default-session)', nodes: [bash(command)] }
}

function bash(value: string) {
  return { type: 'code', lang: 'bash', value } satisfies Code
}

function desktopTab(nodes: RootContent[]): Tab {
  return { kind: 'desktop', label: 'JBrowse Desktop', nodes }
}

// Links rather than the URL as text: once its JSON is percent-encoded the URL
// runs to hundreds of characters and buries the one thing this tab is for.
// Desktop opens only `spec-` sessions, so a session fence's `json-` link gets
// no Desktop twin.
function liveTab(noun: string, webUrl: string, desktopUrl?: string): Tab {
  return {
    kind: 'live',
    label: 'Open in JBrowse',
    nodes: [
      raw(
        [
          `<p><a href="${escapeAttr(webUrl)}" target="_blank" rel="noopener">Open this ${noun} in JBrowse Web ↗</a></p>`,
          ...(desktopUrl
            ? [
                `<p><a href="${escapeAttr(desktopUrl)}">Open this ${noun} in JBrowse Desktop ↗</a> (${DESKTOP_LINK_MIN_VERSION}+)</p>`,
              ]
            : []),
        ].join('\n'),
      ),
    ],
  }
}

function text(value: string) {
  return { type: 'text', value } satisfies PhrasingContent
}

// The Config file tab's one line saying where the JSON goes, which the page
// prose is told not to say (docs/CLAUDE.md). `{ code }` parts render as code.
function placement(
  parts: (string | { code: string })[],
  guide: { title: string; url: string },
): Paragraph {
  return {
    type: 'paragraph',
    data: { hProperties: { className: ['config-tab-hint'] } },
    children: [
      ...parts.map(part =>
        typeof part === 'string'
          ? text(part)
          : ({ type: 'inlineCode', value: part.code } satisfies PhrasingContent),
      ),
      text('. See '),
      { type: 'link', url: guide.url, children: [text(guide.title)] },
      text('.'),
    ],
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
function tabWidget(gid: string, tabs: Tab[]) {
  return [
    raw(`<div class="spec-tabs config-cli-tabs">`),
    ...tabs.flatMap(({ kind, label, nodes }, i) => [
      raw(
        `<input class="spec-tab-input" type="radio" name="${gid}" id="${gid}-${i}" data-tab-kind="${kind}"${
          i === 0 ? ' checked' : ''
        }/>\n<label class="spec-tab-label" for="${gid}-${i}">${label}</label>\n<div class="spec-panel">`,
      ),
      ...nodes,
      raw(`</div>`),
    ]),
    raw(`</div>`),
  ]
}

interface Tab {
  kind: 'config' | 'cli' | 'desktop' | 'live'
  label: string
  nodes: RootContent[]
}

interface TagEntry {
  tag: string
  matches: (node: Code) => boolean
  placement: Paragraph
  // the tabs that follow "Config file". Undefined means this tag has no way to
  // apply this config, which the caller reports using the same entry's
  // `refusal`; an entry that always has one (addtrack, via add-track-json)
  // leaves refusal empty. `warn` reports a tab left out.
  build: (
    config: Record<string, unknown>,
    json: string,
    meta: string | null | undefined,
    warn: (message: string) => void,
  ) => Tab[] | undefined
  refusal: string
}

// Which tag a block carries, and the derivations that tag selects.
const TAGS: TagEntry[] = [
  {
    tag: 'addtrack',
    matches: isAddtrack,
    placement: placement(
      ['Goes in the ', { code: 'tracks' }, ' array of ', { code: 'config.json' }],
      { title: 'Tracks', url: '/docs/config_guides/tracks/' },
    ),
    build: (config, json, meta, warn) => {
      const links = deriveTrackLinks(config, meta)
      if (links && 'refusal' in links) {
        warn(links.refusal)
      }
      return [
        cliTab(config, json),
        desktopTab(desktopTrackNodes(config, json)),
        ...(links && 'webUrl' in links ? [liveTab('track', links.webUrl, links.desktopUrl)] : []),
      ]
    },
    refusal: '',
  },
  {
    tag: 'addassembly',
    matches: isAddassembly,
    placement: placement(
      [
        'Goes in the ',
        { code: 'assemblies' },
        ' array of ',
        { code: 'config.json' },
      ],
      { title: 'Assemblies', url: '/docs/config_guides/assemblies/' },
    ),
    // the GUI tab is absent rather than refusing the widget, the way the
    // session tag's live link is: an assembly the add-genome form has no input
    // for still has a config file and a command.
    build: config => {
      const tab = assemblyCliTab(config)
      const desktop = desktopAssemblyNodes(config)
      return tab && [tab, ...(desktop ? [desktopTab(desktop)] : [])]
    },
    refusal:
      'has no add-assembly equivalent (see derive-add-assembly.ts); leave it untagged',
  },
  {
    tag: 'session',
    matches: isSession,
    placement: placement(
      [
        'Goes at the top level of ',
        { code: 'config.json' },
        ', replacing any ',
        { code: 'defaultSession' },
        ' there',
      ],
      { title: 'Default session', url: '/docs/config_guides/default_session/' },
    ),
    // the live link is opt-in (`config=<url>` in the meta) and simply absent
    // otherwise, rather than a refusal: a session with no hosted config is the
    // normal case for an illustrative block, and the CLI tab still applies.
    build: (config, json, meta) => {
      const cli = sessionCliTab(config, json)
      const url = deriveSessionUrl(config, meta)
      return cli && [cli, ...(url ? [liveTab('session', url)] : [])]
    },
    refusal:
      'is not a lone "defaultSession" (see derive-set-default-session.ts); leave it untagged',
  },
]

// A hand walk rather than unist-util-visit, which is ESM-only and so keeps
// jest from loading this file at all.
export function configCliTabs(
  tree: Root,
  report: (message: string, node: Code) => void,
) {
  let widgets = 0
  const widget = (node: Code) => {
    const entry = TAGS.find(t => t.matches(node))
    if (!entry) {
      return undefined
    }
    const config = parseConfig(node.value)
    // read before it is cleared: the meta carries the tag AND the
    // `config=`/`loc=` a live link is built from
    const meta = node.meta
    node.meta = null
    if (config instanceof Error) {
      report(`${entry.tag} block is not valid JSON: ${config.message}`, node)
      return undefined
    }
    const tabs = entry.build(config, node.value, meta, message => {
      report(`${entry.tag} block ${message}`, node)
    })
    if (tabs === undefined) {
      report(`${entry.tag} block ${entry.refusal}`, node)
      return undefined
    }
    return tabWidget(`cfgtab-${(widgets += 1)}`, [
      {
        kind: 'config',
        label: 'Config file',
        nodes: [structuredClone(entry.placement), node],
      },
      ...tabs,
    ])
  }
  const walk = (parent: Parent) => {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i]!
      const nodes = child.type === 'code' ? widget(child) : undefined
      if (nodes) {
        parent.children.splice(i, 1, ...nodes)
        i += nodes.length - 1
      } else if ('children' in child) {
        walk(child)
      }
    }
  }
  walk(tree)
}

const remarkConfigCliTabs: Plugin<[], Root> = () => {
  return (tree, file) => {
    configCliTabs(tree, (message, node) => {
      file.message(message, node)
    })
  }
}

export default remarkConfigCliTabs
