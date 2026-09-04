// The three v5 ABI-removal tables, in `upgrading_v5.md` and
// `PLUGIN_ABI_STABILITY.md`, from the baselines that already record the answer:
//
//   names     abiPreviousRelease.json (the 4.3.0 tarball) minus abiBaseline.json
//   subpaths  that tarball's published `exports` map minus this repo's
//   breaks    publishedPluginBreaks.json, which abi-watch.yml refreshes weekly
//
// Both lists were hand-synced across the two pages and had drifted in five
// places, counts included — `BaseTooltip` listed as removed while the baseline
// serves it, `renderToStaticMarkup` (which breaks two published plugins)
// missing, `util/mst-reflection` listed as un-published after it was put back.
//
// Only membership is derived. What each group is CALLED, and what a subpath's
// reader should do instead, are editorial and live in the two tables below —
// checked against the diff both ways, so a group naming a name that is still
// served fails here rather than in a doc nobody re-derives.
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import {
  checkOrWriteAll,
  formatMarkdown,
  markdownTableLines,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

const guide = join(repoRoot, 'website/docs/developer_guides/upgrading_v5.md')
const reference = join(repoRoot, 'agent-docs/reference/PLUGIN_ABI_STABILITY.md')

interface NameGroup {
  /** First column: what the group is, in a noun phrase. */
  label: string
  /** Every removed name in the group. Each removed name belongs to one group. */
  names: string[]
  /** The name that took over, for a rename. Rendered `old` → `new`. */
  survivors?: Record<string, string>
}

const NAME_GROUPS: NameGroup[] = [
  {
    label: 'the renderer registry',
    names: [
      'RendererType',
      'FeatureRendererType',
      'BoxRendererType',
      'CircularChordRendererType',
      'ServerSideRendererType',
      'GlyphType',
      'getParentRenderProps',
    ],
  },
  {
    label: 'layout, which moved onto the GPU packing path',
    names: [
      'PileupLayout',
      'SceneGraph',
      'calculateLayoutBounds',
      'getLayoutId',
      'MultiLayout',
      'PrecomputedLayout',
    ],
  },
  {
    label: '`AbortSignal` cancellation, which became stop tokens',
    names: [
      'abortBreakPoint',
      'checkAbortSignal',
      'observeAbortSignal',
      'makeAbortableReaction',
    ],
  },
  {
    label: "the renderer era's RPC retry and progress reporting",
    names: [
      'RetryError',
      'isRetryException',
      'updateStatus2',
      'getProgressDisplayStr',
      'getStatsId',
    ],
  },
  {
    label: 'desktop file handles, which the desktop package now owns',
    names: [
      'getFileHandleCache',
      'setFileHandleCache',
      'removeFileHandle',
      'cleanupStaleHandles',
      'getPendingFileHandleIds',
      'setPendingFileHandleIds',
      'clearPendingFileHandleIds',
      'restorePendingFileHandles',
    ],
  },
  {
    label: 'renames with a survivor',
    names: [
      'contrastingTextColor',
      'checkStopToken2',
      'assembleLocStringFast',
      'findLast',
      'findLastIndex',
    ],
    survivors: {
      contrastingTextColor: 'makeContrasting',
      checkStopToken2: 'checkStopToken',
      assembleLocStringFast: 'assembleLocString',
      findLast: 'Array.prototype.findLast',
      findLastIndex: 'Array.prototype.findLastIndex',
    },
  },
  {
    label:
      'react-dom, which a rendering library should not ask its host for — react-msaview owns its copy from 71e835ae, so published `jbrowse-plugin-msaview` 3.4.0 and `-tview` 2.2.1 break until they ship a build carrying it',
    names: ['renderToStaticMarkup'],
  },
  {
    label:
      'names with no caller left in core, which the last callers inlined or folded away',
    names: [
      'forEachWithStopTokenCheck',
      'TextSearchManager',
      'isContainedWithin',
      'iterMap',
      'when',
      'blobToDataURL',
      'cartesianToPolar',
      'degToRad',
      'getUriLink',
      'defaultStops',
      'useDebouncedCallback',
    ],
  },
  {
    label: 'the config models that were flattened',
    names: ['isConfigurationSlotType'],
  },
]

/** Subpath (without the `@jbrowse/core` prefix) -> what to do instead. */
const SUBPATH_NOTES: Record<string, string> = {
  './pluggableElementTypes/GlyphType':
    'glyphs are drawn by the GPU displays, not registered',
  './pluggableElementTypes/renderers/RendererType':
    'renderer registry removed; displays compose RenderLifecycleMixin + DisplayChrome',
  './pluggableElementTypes/renderers/FeatureRendererType':
    'renderer registry removed',
  './pluggableElementTypes/renderers/BoxRendererType':
    'renderer registry removed',
  './pluggableElementTypes/renderers/CircularChordRendererType':
    'renderer registry removed',
  './pluggableElementTypes/renderers/ServerSideRendererType':
    'renderer registry removed, core no longer renders on the server',
  './pluggableElementTypes/renderers/LayoutSession':
    'the block layout cache the box renderer kept; layout moved onto the GPU packing path',
  './pluggableElementTypes/renderers/util':
    'helpers for the classes above, deleted with them',
  './data_adapters/BaseAdapter/BaseOptions':
    'the adapter options bag, folded into `data_adapters/BaseAdapter` itself, which still exports `BaseOptions` and is still a published subpath',
  './rpc/methods/util': 'renderer-era RPC helpers, removed with `CoreRender`',
  './util/offscreenCanvasUtils':
    'the server-side canvas helpers behind `renderToAbstractCanvas`',
  './util/compositeMap': 'dead, with no caller in or out of the tree',
  './util/layouts/BaseLayout':
    'the interface `GranularRectLayout` implemented for `MultiLayout` and `PrecomputedLayout` to share; deleted with them, along with the serialization types (`SerializedLayout`, `RectTuple`) that only the worker-to-main layout handoff used',
  './rpc/coreRpcMethods':
    'alive — `CorePlugin` imports `packages/core/src/rpc/coreRpcMethods.ts` relatively, so nothing publishes the subpath any more',
  './ui/ErrorMessage':
    'alive, and `@jbrowse/core/ui` still exports it as `ErrorMessage` — import it from the barrel',
  './util/QuickLRU':
    'alive, a vendored copy of the npm package of the same name that core reaches relatively — depend on `quick-lru` yourself',
}

interface Previous {
  version: string
  subpaths: string[]
  modules: Record<string, string[]>
}

const read = (file: string) =>
  JSON.parse(readFileSync(join(repoRoot, file), 'utf8'))

/** Removed name -> the modules 4.3.0 served it from. */
function removedNames() {
  const previous = read(
    'packages/core/src/ReExports/abiPreviousRelease.json',
  ) as Previous
  const current = read(
    'packages/core/src/ReExports/abiBaseline.json',
  ) as Record<string, string[]>
  const out = new Map<string, string[]>()
  for (const [mod, names] of Object.entries(previous.modules)) {
    const served = new Set(current[mod] ?? [])
    for (const name of names.filter(n => !served.has(n))) {
      out.set(name, [...(out.get(name) ?? []), mod])
    }
  }
  return out
}

/** Subpaths 4.3.0's published `exports` map served and this build's does not. */
function removedSubpaths() {
  const previous = read(
    'packages/core/src/ReExports/abiPreviousRelease.json',
  ) as Previous
  const pkg = read('packages/core/package.json') as {
    publishConfig: { exports: Record<string, unknown> }
  }
  const served = new Set(Object.keys(pkg.publishConfig.exports))
  return previous.subpaths.filter(s => !served.has(s))
}

// Both directions, because both are silent. A group naming a name the host
// still serves is the `BaseTooltip` entry that sat here for weeks; a removed
// name in no group is `renderToStaticMarkup`, which breaks two published
// plugins and was in neither page.
function assertCovers(kind: string, removed: string[], described: string[]) {
  const missing = removed.filter(n => !described.includes(n))
  const extra = described.filter(n => !removed.includes(n))
  const duplicated = described.filter((n, i) => described.indexOf(n) !== i)
  if (missing.length + extra.length + duplicated.length > 0) {
    console.error(
      `abi removals: the ${kind} table disagrees with the baselines it is derived from.\n${[
        missing.length > 0 &&
          `  removed but described nowhere: ${missing.join(', ')}`,
        extra.length > 0 && `  described but still served: ${extra.join(', ')}`,
        duplicated.length > 0 && `  described twice: ${duplicated.join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n')}`,
    )
    process.exit(1)
  }
}

function namesBody() {
  const removed = removedNames()
  assertCovers(
    'removed-name',
    [...removed.keys()],
    NAME_GROUPS.flatMap(g => g.names),
  )
  const entries = [...removed.values()].reduce((a, m) => a + m.length, 0)
  const shared = [...removed.values()].filter(m => m.length > 1)
  const most = Math.max(...removed.values().map(m => m.length))
  const rows = NAME_GROUPS.map(
    ({ label, names, survivors }) =>
      `| ${label} | ${names
        .map(n =>
          survivors?.[n] ? `\`${n}\` → \`${survivors[n]}\`` : `\`${n}\``,
        )
        .join(', ')} |`,
  )
  return [
    `${removed.size} names over ${entries} entries, since ${shared.length} of them were served from ${most === 2 ? 'two modules' : 'more than one module'} each.`,
    '',
    '<!-- prettier-ignore -->',
    ...markdownTableLines(['What went', 'Names'], rows),
  ]
}

function subpathsBody() {
  const removed = removedSubpaths()
  assertCovers('removed-subpath', removed, Object.keys(SUBPATH_NOTES))
  const rows = removed.map(
    s => `| \`@jbrowse/core${s.slice(1)}\` | ${SUBPATH_NOTES[s]} |`,
  )
  return [
    `${removed.length} subpaths the published \`exports\` map no longer serves, against what 4.3.0 published.`,
    '',
    '<!-- prettier-ignore -->',
    ...markdownTableLines(['Subpath', 'What happened'], rows),
  ]
}

function breaksBody() {
  const plugins = read(
    'packages/core/src/ReExports/publishedPluginBreaks.json',
  ) as { plugin: string; breaks: string[] }[]
  const broken = plugins.filter(p => p.breaks.length > 0)
  const rows = broken.map(
    p => `| ${p.plugin} | ${p.breaks.map(b => `\`${b}\``).join('<br />')} |`,
  )
  return [
    `${broken.length} of the ${plugins.length} plugins in the store break against this build.`,
    '',
    '<!-- prettier-ignore -->',
    ...markdownTableLines(['Plugin', 'What breaks'], rows),
  ]
}

const names = namesBody()
const subpaths = subpathsBody()

function spliceBoth(path: string, blocks: [string, string[]][]) {
  let text = readFileSync(path, 'utf8')
  for (const [marker, body] of blocks) {
    text = spliceGeneratedBlock({ path, marker, body, text })
  }
  return {
    path,
    content: formatMarkdown(text, path),
    label: relative(repoRoot, path),
  }
}

checkOrWriteAll(
  [
    spliceBoth(guide, [
      ['ABI_REMOVED_NAMES', names],
      ['ABI_PLUGIN_BREAKS', breaksBody()],
      ['ABI_REMOVED_SUBPATHS', subpaths],
    ]),
    spliceBoth(reference, [
      ['ABI_REMOVED_NAMES', names],
      ['ABI_REMOVED_SUBPATHS', subpaths],
    ]),
  ],
  'run `pnpm autogen`',
)
