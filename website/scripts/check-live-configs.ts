import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { CODE_BASE } from '../src/lib/code-base.ts'
import { reportProblems } from './check-utils.ts'
import { repoRoot } from './paths.ts'
import { screenshotLiveUrls } from './screenshot-specs.ts'
import { videoLiveUrls } from './video-specs.ts'

// Every figure's "Open this view in JBrowse" link is `<CODE_BASE>?config=…`, and
// a relative config is served by the hosted build out of its own bundled
// `test_data/`. So a spec may only name a config that ships:
//
//   - it must be in the repo *and tracked*. `test_data/graphgenomeview/
//     *_local.json` (a local plugin build) is gitignored, and three specs were
//     switched to those files in an unrelated commit — the figures still
//     rendered here, so nothing failed, while every reader-facing link pointed
//     at a file that exists on no server.
//   - `--network` additionally fetches each one against CODE_BASE. That is what
//     catches the other half: the released build carries the test_data of its
//     own release, so a config added since 404s there even though it is tracked.
//
// Lives here rather than in a *.test.ts because jest doesn't cover website/, and
// screenshot-specs.ts pulls puppeteer in through its barrel.

const network = process.argv.includes('--network')

// Repo configs also published under jbrowse.org/demos, which is a stable URL a
// doc can hand a reader ("open the whole thing") without it depending on which
// build the docs point at. `--network` asserts the copy still matches the file,
// since nothing else would notice a track added here and not there.
//
// THE REPO COPY IS `demos/<name>/config.json`, which is what deploy-demo.sh
// uploads and therefore the only file the hosted one can be compared with. This
// named the screenshot FIXTURE for the HPRC entry, and the fixture is a
// different config on purpose: it carries the CFHR and inversion synteny
// tracks, their CAT gene slices and an hs1, all of which read files that exist
// only in this repo, so the demo cannot serve them and is right to be narrower.
// The check therefore reported a ten-track difference that was never going to
// close — and under that permanent red, the one-line difference that mattered
// (a stale plugin pin) was invisible.
const HOSTED_MIRRORS: Record<string, string> = {
  'demos/hprc/config.json': 'https://jbrowse.org/demos/hprc/config.json',
}

// A demo names the plugin's UNVERSIONED entry point; a screenshot fixture pins a
// content-addressed build, and they all pin the same one.
//
// The two halves are the same argument from opposite ends. A figure must not
// change without a commit here to attribute it to, so its fixture pins. A demo
// is a session a visitor opens, so it wants what the tutorials tell that visitor
// to install, which is the unversioned url — and pinning one buys nothing and
// costs a bump nobody remembers: `demos/hprc/config.json` went stale twice this
// way, once two builds behind (`29402c586a`, which cost visitors a Bandage
// engine that aborted on every minigraph rGFA and then exhausted the worker's
// heap) and once one build behind, missing the capped deletion bow the HPRC page
// is full of. Its sibling `demos/ecoli_pangenome/config.json` has never gone
// stale, because it names the unversioned url and picks each publish up.
//
// `*_local.json` is the GRAPH_PLUGIN_LOCAL switch's output, gitignored and
// pointed at a local build on purpose.
const PLUGIN_URL_RE =
  /https:\/\/jbrowse\.org\/demos\/graphgenomeviewer\/(?:([0-9a-f]+)\/)?jbrowse-plugin-graphgenomeviewer\.esm\.js/g

function pluginUrls(dir: string) {
  const found: { file: string; hash: string | undefined }[] = []
  for (const entry of readdirSync(join(repoRoot, dir), {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.name.endsWith('.json') || entry.name.endsWith('_local.json')) {
      continue
    }
    const file = join(entry.parentPath, entry.name)
    for (const m of readFileSync(file, 'utf8').matchAll(PLUGIN_URL_RE)) {
      found.push({ file: relative(repoRoot, file), hash: m[1] })
    }
  }
  return found
}

function checkPluginPins() {
  const problems: string[] = []
  const fixtures = pluginUrls('test_data')
  const demos = pluginUrls('demos')
  for (const { file, hash } of fixtures) {
    if (!hash) {
      problems.push(
        `${file} names the plugin's unversioned entry point, so a publish changes its figures with no commit here to attribute it to. Pin it (test_data/graphgenomeview/README.md).`,
      )
    }
  }
  const pins = new Set(fixtures.map(f => f.hash).filter(Boolean))
  if (pins.size > 1) {
    problems.push(
      `the fixtures pin ${pins.size} different plugin builds (${[...pins].join(', ')}), so the figures were not all rendered against one:\n    ${fixtures.map(f => `${f.file} ${f.hash}`).join('\n    ')}`,
    )
  }
  for (const { file, hash } of demos) {
    if (hash) {
      problems.push(
        `${file} pins the plugin at ${hash}, so a visitor opening it gets whatever build was current when someone last remembered. Name the unversioned entry point, as demos/ecoli_pangenome/config.json does.`,
      )
    }
  }
  return problems
}

function configOf(url: string) {
  const q = url.indexOf('?')
  return q === -1
    ? undefined
    : (new URLSearchParams(url.slice(q + 1)).get('config') ?? undefined)
}

// Grouped by config so the report names the file once with its figures under it,
// which is also the unit a fix is applied in.
//
// THE TOURS ARE IN HERE TOO. A video's caption carries the same kind of link a
// figure's does, and for a tour it is the more load-bearing of the two: a
// figure's link opens the state the figure already shows, where a tour's opens
// the state it STARTS in, so a reader who watched the route can walk it. That
// link had nothing checking it, and `pangenome/hprc_end_to_end` is the first one
// pointed at a config no figure names.
const specsByConfig = new Map<string, string[]>()
for (const [name, url] of [
  ...Object.entries(screenshotLiveUrls),
  ...Object.entries(videoLiveUrls),
]) {
  const config = configOf(url)
  if (config && config !== 'none') {
    const existing = specsByConfig.get(config)
    if (existing) {
      existing.push(name)
    } else {
      specsByConfig.set(config, [name])
    }
  }
}

function isTracked(path: string) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', path], {
      cwd: repoRoot,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

async function status(url: string) {
  try {
    const res = await fetch(url, { method: 'GET' })
    return res.status
  } catch (e) {
    return `unreachable (${e instanceof Error ? e.message : String(e)})`
  }
}

const problems: string[] = [...checkPluginPins()]

for (const [config, names] of specsByConfig) {
  if (!config.startsWith('http') && !isTracked(config)) {
    problems.push(
      `${config} is not tracked in git, so the hosted build never serves it\n    ${names.join('\n    ')}`,
    )
  }
}

if (network) {
  const results = await Promise.all(
    [...specsByConfig.keys()].map(async config => {
      const url = config.startsWith('http') ? config : `${CODE_BASE}${config}`
      return { config, url, status: await status(url) }
    }),
  )
  for (const result of results.sort((a, b) =>
    a.config.localeCompare(b.config),
  )) {
    const ok = result.status === 200
    console.log(`${ok ? '✓' : '✗'} ${result.status}  ${result.config}`)
    if (!ok) {
      problems.push(
        `${result.url} -> ${result.status}\n    ${specsByConfig.get(result.config)!.join('\n    ')}`,
      )
    }
  }

  await Promise.all(
    Object.entries(HOSTED_MIRRORS).map(async ([config, url]) => {
      const local = readFileSync(join(repoRoot, config), 'utf8')
      const res = await fetch(url)
      const hosted = res.ok ? await res.text() : undefined
      const same =
        hosted !== undefined &&
        JSON.stringify(JSON.parse(hosted)) === JSON.stringify(JSON.parse(local))
      if (same) {
        console.log(`✓ mirror  ${url}`)
      } else {
        problems.push(
          hosted === undefined
            ? `${url} -> ${res.status}, mirroring ${config}`
            : `${url} has drifted from ${config}\n    re-upload: aws s3 cp ${config} s3://jbrowse.org/demos/<dir>/config.json --content-type application/json`,
        )
      }
    }),
  )
}

const figures = Object.keys(screenshotLiveUrls).length
const tours = Object.keys(videoLiveUrls).length
reportProblems(
  problems.length > 0
    ? [
        `\nconfigs that a reader's live link cannot load${network ? '' : ' (run with --network to also check they are published)'}:\n`,
        ...problems.map(problem => `  ${problem}\n`),
      ]
    : [],
  `\n${specsByConfig.size} configs across ${figures} figure and ${tours} tour links${network ? ` all load from ${CODE_BASE}` : ' are all tracked'}`,
)
