// Every ```json session fence carrying `config=<url>` gets a live link, and
// this asserts the link opens something: that the config it names is one this
// repo publishes, and that every trackId and assembly the session asks for
// exists in it.
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
//     products/jbrowse-web/test_data/<name>/, which push.yml `aws s3 sync
//     --delete`s to code/jb2/main/ on every commit to main. Always this repo's.
//     This is what the figure specs' own live links use.
//
// `pnpm check-live-configs --network` is the counterpart that asks whether the
// deploy actually happened.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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
import { docFiles, reportProblems } from './check-utils.ts'
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

interface DemoConfig {
  assemblies?: { name?: unknown }[]
  tracks?: { trackId?: unknown }[]
}

const parser = unified().use(remarkParse).use(remarkGfm)
const problems: string[] = []
let checked = 0

for (const file of docFiles(docsDir)) {
  const rel = docRelative(file)
  visit(parser.parse(readFileSync(file, 'utf8')), 'code', node => {
    const configUrl = isSession(node) ? sessionConfigUrl(node.meta) : undefined
    if (configUrl === undefined) {
      return
    }
    const where = `${rel}:${node.position?.start.line ?? 0}`
    const path = repoConfigPath(configUrl)
    if (path === undefined) {
      problems.push(
        `  ${where}`,
        `    → config=${configUrl} is not a config this repo publishes, so`,
        `      nothing here can say the link opens. Use a`,
        `      https://jbrowse.org/demos/<name>/config.json or a relative`,
        `      test_data/<name>/config.json, or drop \`config=\` and keep the`,
        `      Config/CLI tabs.\n`,
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
  `All ${checked} session live link(s) name a config this repo publishes, with every track and assembly in it.`,
)
