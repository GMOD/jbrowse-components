import { CODE_BASE, retargetCodeBase } from './code-base.ts'
import { deriveAddAssembly } from './derive-add-assembly.ts'
import { deriveAddTrack, deriveAddTrackJson } from './derive-add-track.ts'
import {
  desktopAssemblyNodes,
  desktopTrackNodes,
} from './derive-desktop-steps.ts'
import {
  deriveSessionUrl,
  fenceMeta,
  namesInSession,
} from './derive-session-url.ts'
import { deriveSetDefaultSession } from './derive-set-default-session.ts'
import { deriveTrackLinks, liveLinks, specUrl } from './derive-track-url.ts'
import { escapeAttr } from './inline-html.ts'
import { desktopLinkHtml } from './desktop-link.ts'
import { panels } from './spec-recipe/html.ts'
import { buildRecipe } from './spec-recipe/recipe.ts'
import { APP_TAB, JSON_TAB_KIND } from './tab-kinds.ts'

import type { LiveLinks } from './derive-track-url.ts'
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
// assembly config), `session` (a `defaultSession`) or `live` (a session spec)
// renders as a tabbed widget: the JSON, unchanged, beside every other way to
// apply the same thing, each derived from that same JSON so they can't drift.
// The tab strip is what routes a reader who owns no config.json — a Desktop
// user's only route is the GUI one, and a page that names it in prose instead
// leaves a stray JSON block under a paragraph they cannot act on.
//
// A `live` fence, a `session` fence carrying `config=<url>` and an `addtrack`
// fence carrying `config=` or `loc=` get an "Open in JBrowse" tab. When that
// link is a `spec-` session, the figure recipe's tabs the fence has no
// equivalent of (Notebook, Image) follow it.
//
// Invalid JSON degrades to a plain block with a build-time warning, as does an
// `addassembly` or `session` config no command can express (unlike tracks,
// neither has a verbatim-JSON fallback command).
//
// Each radio input carries `data-tab-kind`, which TabMemory.astro matches to
// check the same kind of tab in every widget once a reader picks one.

function raw(value: string): RootContent {
  return { type: 'html', value }
}

function tagged(node: Code, tag: string) {
  return node.lang === 'json' && tag in fenceMeta(node.meta)
}

// Exported so scripts/check-config-cli.ts selects exactly the blocks this
// renders — it used to re-detect them with its own column-0 fence regex, which
// would silently skip an indented fence and read as a pass.
export function isAddtrack(node: Code) {
  return tagged(node, 'addtrack')
}

export function isAddassembly(node: Code) {
  return tagged(node, 'addassembly')
}

export function isSession(node: Code) {
  return tagged(node, 'session')
}

export function isLive(node: Code) {
  return tagged(node, 'live')
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
    nodes: [
      cliPlacement([
        'Edits ',
        { code: 'config.json' },
        ' in the current folder',
      ]),
      bash(command ?? deriveAddTrackJson(json)),
    ],
  }
}

// An assembly has no verbatim-JSON command to fall back on, so a config
// deriveAddAssembly refuses gets no widget at all (the caller warns).
function assemblyCliTab(config: Record<string, unknown>): Tab | undefined {
  const command = deriveAddAssembly(config)
  return command === null
    ? undefined
    : {
        kind: 'cli',
        label: 'CLI (add-assembly)',
        nodes: [
          cliPlacement([
            'Edits ',
            { code: 'config.json' },
            ' in the current folder, creating it if there is none',
          ]),
          bash(command),
        ],
      }
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
    : {
        kind: 'cli',
        label: 'CLI (set-default-session)',
        nodes: [
          cliPlacement([
            'Replaces any ',
            { code: 'defaultSession' },
            ' in ',
            { code: 'config.json' },
            ' in the current folder',
          ]),
          bash(command),
        ],
      }
}

function bash(value: string) {
  return { type: 'code', lang: 'bash', value } satisfies Code
}

function desktopTab(nodes: RootContent[]): Tab {
  return { ...APP_TAB, nodes }
}

// Links rather than the URL as text: once its JSON is percent-encoded the URL
// runs to hundreds of characters and buries the one thing this tab is for.
function liveTab(noun: string, { webUrl, desktopUrl }: LiveLinks): Tab {
  return {
    kind: 'live',
    label: 'Open in JBrowse',
    nodes: [
      raw(
        [
          `<p><a href="${escapeAttr(webUrl)}" target="_blank" rel="noopener">Open this ${noun} in JBrowse Web ↗</a></p>`,
          `<div>${desktopLinkHtml({ webUrl, desktopUrl, label: `Open this ${noun} in JBrowse Desktop ↗` })}</div>`,
        ].join('\n'),
      ),
    ],
  }
}

// The recipe's panels are HTML strings, so each is one raw node here. Its
// Agent panel stays in the figure dialog.
function recipeTabs(webUrl: string, gid: string, have: string[]): Tab[] {
  const recipe = buildRecipe(webUrl)
  return recipe
    ? panels(recipe, gid)
        .filter(({ kind }) => kind !== 'agent' && !have.includes(kind))
        .map(({ kind, label, body }) => ({ kind, label, nodes: [raw(body)] }))
    : []
}

function text(value: string) {
  return { type: 'text', value } satisfies PhrasingContent
}

// The one line atop the Config file and CLI tabs saying which config.json the
// JSON lands in, which the page prose is told not to say (agent-docs/reference/WEBSITE_WRITING.md).
// `{ code }` parts render as code.
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

function cliPlacement(parts: (string | { code: string })[]) {
  return placement(parts, {
    title: 'JBrowse CLI with Desktop',
    url: '/docs/tutorials/cli_desktop/',
  })
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
  kind: string
  label: string
  nodes: RootContent[]
}

interface TagEntry {
  tag: string
  matches: (node: Code) => boolean
  // the first tab, which holds the JSON as written
  label: string
  placement?: Paragraph
  // the tabs that follow the first. Undefined means this tag has no way to
  // apply this config, which the caller reports using the same entry's
  // `refusal`; an entry that always has one (addtrack, via add-track-json)
  // leaves refusal empty.
  build: (
    config: Record<string, unknown>,
    json: string,
    // the trackIds the page's sessions open
    sessionTrackIds: Set<string>,
  ) => Tab[] | undefined
  refusal: string
  // the "Open in JBrowse" tab, whose links are undefined when the fence has
  // none; `warn` reports one left out
  live?: {
    noun: string
    links: (
      config: Record<string, unknown>,
      meta: string | null | undefined,
      warn: (message: string) => void,
    ) => LiveLinks | undefined
  }
}

// Which tag a block carries, and the derivations that tag selects.
const TAGS: TagEntry[] = [
  {
    tag: 'addtrack',
    matches: isAddtrack,
    label: 'Config file',
    placement: placement(
      ['Goes in the ', { code: 'tracks' }, ' array of ', { code: 'config.json' }],
      { title: 'Tracks', url: '/docs/config_guides/tracks/' },
    ),
    build: (config, json, sessionTrackIds) => [
      cliTab(config, json),
      desktopTab(
        desktopTrackNodes(
          config,
          json,
          sessionTrackIds.has(String(config.trackId)),
        ),
      ),
    ],
    refusal: '',
    live: {
      noun: 'track',
      links: (config, meta, warn) => {
        const links = deriveTrackLinks(config, meta)
        if (links && 'refusal' in links) {
          warn(links.refusal)
        }
        return links && 'webUrl' in links ? links : undefined
      },
    },
  },
  {
    tag: 'addassembly',
    matches: isAddassembly,
    label: 'Config file',
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
    label: 'Config file',
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
    build: (config, json) => {
      const cli = sessionCliTab(config, json)
      return cli && [cli]
    },
    refusal:
      'is not a lone "defaultSession" (see derive-set-default-session.ts); leave it untagged',
    // opt-in (`config=<url>` in the meta) and simply absent otherwise, rather
    // than a refusal: a session with no hosted config is the normal case for
    // an illustrative block, and the CLI tab still applies.
    live: {
      noun: 'session',
      links: (config, meta) => {
        const url = deriveSessionUrl(config, meta)
        return url === undefined ? undefined : liveLinks(url)
      },
    },
  },
  {
    tag: 'live',
    matches: isLive,
    label: 'Session spec',
    build: () => [],
    refusal: '',
    // An explicit `base=` is retargeted like any hand-written link. With none
    // the base IS CODE_BASE, not a copy of it: retargetCodeBase rewrites only
    // `latest/` URLs, so it could not rescue a hardcoded default.
    live: {
      noun: 'view',
      links: (config, meta) => {
        const { base, config: configUrl = '' } = fenceMeta(meta)
        return liveLinks(
          specUrl(base ? retargetCodeBase(base) : CODE_BASE, configUrl, config),
        )
      },
    },
  },
]

// A hand walk rather than unist-util-visit, which is ESM-only and so keeps
// jest from loading this file at all.
export function configCliTabs(
  tree: Root,
  report: (message: string, node: Code) => void,
) {
  let widgets = 0
  const sessionTrackIds = new Set<string>()
  const collect = (parent: Parent) => {
    for (const child of parent.children) {
      if (child.type === 'code') {
        const config =
          child.lang === 'json' && !isAddtrack(child) && !isAddassembly(child)
            ? parseConfig(child.value)
            : undefined
        if (config && !(config instanceof Error)) {
          for (const trackId of namesInSession(config).trackIds) {
            sessionTrackIds.add(trackId)
          }
        }
      } else if ('children' in child) {
        collect(child)
      }
    }
  }
  collect(tree)
  const widget = (node: Code) => {
    const entry = TAGS.find(t => t.matches(node))
    if (!entry) {
      return undefined
    }
    const config = parseConfig(node.value)
    // read before it is cleared: the meta carries the tag AND the
    // `config=`/`loc=`/`base=` a live link is built from
    const meta = node.meta
    node.meta = null
    if (config instanceof Error) {
      report(`${entry.tag} block is not valid JSON: ${config.message}`, node)
      return undefined
    }
    const tabs = entry.build(config, node.value, sessionTrackIds)
    if (tabs === undefined) {
      report(`${entry.tag} block ${entry.refusal}`, node)
      return undefined
    }
    const gid = `cfgtab-${(widgets += 1)}`
    const fenceTabs: Tab[] = [
      {
        kind: JSON_TAB_KIND,
        label: entry.label,
        nodes: [
          ...(entry.placement ? [structuredClone(entry.placement)] : []),
          node,
        ],
      },
      ...tabs,
    ]
    const live = entry.live
    const links = live?.links(config, meta, message => {
      report(`${entry.tag} block ${message}`, node)
    })
    return tabWidget(
      gid,
      live && links
        ? [
            ...fenceTabs,
            liveTab(live.noun, links),
            ...recipeTabs(links.webUrl, gid, [
              ...fenceTabs.map(t => t.kind),
              'live',
            ]),
          ]
        : fenceTabs,
    )
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
