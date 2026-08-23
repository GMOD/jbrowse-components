// Every ```json session fence carrying `config=<url>` gets a live link, and
// this asserts the link opens something: that the config it names is one this
// repo publishes AND tracks, that every trackId and assembly the session asks
// for exists in it, and that the session opens at least one track.
//
// The failure this exists for is silent by design. A session naming a track
// that is not in the config's `tracks` array opens WITHOUT it — no error, no
// snackbar, just a view missing a track — which docs/config_guides/
// default_session.md warns readers about and nothing checked. The link is the
// worst place for it, since a reader clicking it concludes the feature is
// broken rather than the doc.
//
// Offline on purpose, because both ways this repo publishes a config have a
// checked-in source:
//
//   * `https://jbrowse.org/demos/<name>/config.json` ← demos/<name>/config.json,
//     pushed by scripts/deploy-demo.sh. A manual deploy to a bucket with no
//     versioning, so the hosted bytes can lag the repo.
//   * a relative `test_data/<name>/config.json`, resolved against CODE_BASE ←
//     products/jbrowse-web/test_data/<name>/ (a symlink to the repo-root
//     test_data/), which push.yml builds and then `aws s3 sync --delete`s to
//     code/jb2/main/ on every commit to main. Always this repo's. This is what
//     the figure specs' own live links use.
//
// Tracked-in-git is asked here, per fence (isTracked below), so the half of
// "is it published" that is decidable offline is covered by construction.
//
// The other half — did the deploy actually happen — is `pnpm check-live-configs
// --network`, and only incidentally, because that one iterates the FIGURE
// specs' configs rather than the docs'. A fence's config is covered there while
// some spec happens to name the same file; all three currently do, and nothing
// keeps that so. It matters for the demos/ form and barely at all for
// test_data/: one is a manual push to an unversioned bucket, the other follows
// from being tracked. Nothing runs --network on a schedule.
import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { join, relative as relativePath } from 'node:path'

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import {
  namesInSession,
  sessionConfigUrl,
} from '../src/lib/derive-session-url.ts'
import { defaultSessionObject } from '../src/lib/derive-set-default-session.ts'
import { isSession } from '../src/lib/remark-config-cli-tabs.ts'
import { docsMatching, reportProblems } from './check-utils.ts'
import { docRelative, docsDir, repoRoot } from './paths.ts'

const DEMO_PREFIX = 'https://jbrowse.org/demos/'
const TEST_DATA_PREFIX = 'test_data/'

// The checked-in source of a published config, or undefined for one this repo
// does not publish — a link to someone else's config is not ours to verify, and
// saying so beats guessing.
function repoConfigPath(url: string) {
  if (!url.endsWith('/config.json')) {
    return undefined
  }
  if (url.startsWith(DEMO_PREFIX)) {
    return join(repoRoot, 'demos', url.slice(DEMO_PREFIX.length))
  }
  return url.startsWith(TEST_DATA_PREFIX)
    ? join(repoRoot, 'products', 'jbrowse-web', url)
    : undefined
}

// The relative form of an absolute `<code base>/test_data/<name>/config.json`,
// which is what a figure's "Open this view in JBrowse" link shows and so the
// natural thing for an author to paste. It is a config this repo publishes, so
// "not one we publish" would be a lie; it is still the wrong spelling, because
// only the relative form retargets with JBROWSE_CODE_BASE (see
// src/lib/code-base.ts) instead of pinning every reader to one build.
function codeBaseRelative(url: string) {
  return /^https?:\/\/[^/]+\/code\/jb2\/[^/]+\/(test_data\/.+)$/.exec(url)?.[1]
}

// On disk is not the same question as published, and the gap is a real one that
// has already bitten: test_data/graphgenomeview/*_local.json is a local plugin
// build and gitignored, so it reads fine here and is served by nothing. Reading
// the file proves the trackIds; only git proves a reader can load it. This is
// the same test check-live-configs applies to the figure specs' configs, which
// covers a fence's config only when some spec happens to name the same file.
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

interface DemoConfig {
  assemblies?: { name?: unknown }[]
  tracks?: { trackId?: unknown }[]
}

const parser = unified().use(remarkParse).use(remarkGfm)
const problems: string[] = []
let checked = 0

// Weaker than isSession by construction — a `session` fence is where its lang
// and meta come from — so nothing this skips could have matched.
const SESSION_FENCE = /^\s*(?:```|~~~)json\b[^\n]*\bsession\b/m

for (const { file, text } of docsMatching(docsDir, SESSION_FENCE)) {
  const rel = docRelative(file)
  visit(parser.parse(text), 'code', node => {
    const configUrl = isSession(node) ? sessionConfigUrl(node.meta) : undefined
    if (configUrl === undefined) {
      return
    }
    const where = `${rel}:${node.position?.start.line ?? 0}`
    const path = repoConfigPath(configUrl)
    if (path === undefined) {
      const relative = codeBaseRelative(configUrl)
      problems.push(
        `  ${where}`,
        ...(relative
          ? [
              `    → config=${configUrl} pins one build. Write it relative —`,
              `      config=${relative} — so the link retargets with`,
              `      JBROWSE_CODE_BASE the way the figures' links do.\n`,
            ]
          : [
              `    → config=${configUrl} is not a config this repo publishes, so`,
              `      nothing here can say the link opens. Use a`,
              `      https://jbrowse.org/demos/<name>/config.json or a relative`,
              `      test_data/<name>/config.json, or drop \`config=\` and keep the`,
              `      Config/CLI tabs.\n`,
            ]),
      )
      return
    }
    let config: DemoConfig
    try {
      config = JSON.parse(readFileSync(path, 'utf8')) as DemoConfig
    } catch (e) {
      problems.push(
        `  ${where}`,
        `    → config=${configUrl} → ${path.slice(repoRoot.length + 1)}: ${(e as Error).message}\n`,
      )
      return
    }
    // realpath first: products/jbrowse-web/test_data is itself a symlink to the
    // repo-root test_data/, and git tracks the LINK, so ls-files on a path
    // through it matches nothing and every test_data config would read as
    // untracked. Safe here because the read above proved the file exists.
    if (!isTracked(relativePath(repoRoot, realpathSync(path)))) {
      problems.push(
        `  ${where}`,
        `    → config=${configUrl} → ${path.slice(repoRoot.length + 1)} is not`,
        `      tracked in git, so it exists in this checkout and on no server.`,
        `      The link would 404 for every reader.\n`,
      )
      return
    }
    let session: unknown
    try {
      session = defaultSessionObject(JSON.parse(node.value))
    } catch {
      // check-config-cli reports the parse failure against this same block
      return
    }
    if (session === null) {
      return
    }
    checked++
    const { trackIds, assemblies } = namesInSession(session)
    // The names resolving is not the same as the link being worth following. A
    // session that opens no tracks resolves perfectly and lands the reader on an
    // empty browser, which is the "concludes the feature is broken rather than
    // the doc" case above arriving by the other road. Nothing about the config
    // can catch it, so it is checked against the session itself.
    if (trackIds.length === 0) {
      problems.push(
        `  ${where}`,
        `    → the session opens no tracks, so its live link would land the`,
        `      reader on an empty view. Name the tracks it should open, or drop`,
        `      \`config=\` and keep the Config/CLI tabs.\n`,
      )
      return
    }
    const haveTracks = new Set(
      (config.tracks ?? []).map(t => t.trackId).filter(id => id !== undefined),
    )
    const haveAssemblies = new Set(
      (config.assemblies ?? []).map(a => a.name).filter(n => n !== undefined),
    )
    for (const id of trackIds.filter(id => !haveTracks.has(id))) {
      problems.push(
        `  ${where}`,
        `    → the session opens track "${id}", which ${configUrl} does not define.`,
        `      The view would open without it and say nothing.\n`,
      )
    }
    for (const name of assemblies.filter(n => !haveAssemblies.has(n))) {
      problems.push(
        `  ${where}`,
        `    → the session opens assembly "${name}", which ${configUrl} does not define.\n`,
      )
    }
  })
}

if (problems.length) {
  problems.unshift(
    `Found \`json session\` live links whose config does not back them:\n`,
  )
}
reportProblems(
  problems,
  `All ${checked} session live link(s) open a tracked config this repo publishes, with every track and assembly they name in it.`,
)
