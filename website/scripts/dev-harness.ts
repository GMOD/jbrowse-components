// The preamble every hand-run probe/profile script wrote out for itself: find
// the named screenshot spec, stand a server up over the local jbrowse-web
// build, launch chrome, open the spec's url, and take the server down again
// afterwards. Five scripts carried a copy, and three of them leaked the server
// when anything threw before their `try`.
//
// Only the shared spine lives here. What each script does with the page — CDP
// tracing, worker probes, RPC interception — stays in that script, and so do
// the chrome flags it needs, which are the reason `launch` is parameterized
// rather than fixed.
import path from 'node:path'

import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { repoRoot } from './paths.ts'
import { specs } from './screenshot-specs.ts'

import type { SessionUrlSpec } from './screenshot-specs.ts'
import type { Browser, Page } from 'puppeteer'

// The build these scripts drive. `createTestServer` serves it alongside the
// repo root, so a spec's `test_data/...` config resolves too.
export const jbrowseWebRoot = path.join(repoRoot, 'products', 'jbrowse-web')

// `--name=value` off argv, for the scripts that predate parseArgs.
export function flagArg(name: string, fallback: string) {
  return (
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
    fallback
  )
}

// The named spec, or exit with `usage`. Only url-mode specs can be driven this
// way — a compose/stages spec has no single page to open.
export function resolveUrlSpec(
  name: string | undefined,
  usage: string,
): SessionUrlSpec {
  const found = specs.find(s => s.name === name)
  if (!found || found.mode !== 'url') {
    console.error(usage)
    process.exit(1)
  }
  return found
}

// The viewport a spec is captured at. The defaults are the generator's, so a
// probe sees the layout the figure does.
export function specViewport(spec: SessionUrlSpec) {
  return {
    width: spec.viewportWidth ?? 1500,
    height: spec.viewportHeight ?? 800,
    deviceScaleFactor: 1,
  }
}

// A spec's url against the local server, unless it already names a remote one.
export function specUrl(spec: SessionUrlSpec, port: number) {
  return spec.url.startsWith('http')
    ? spec.url
    : `http://localhost:${port}/${spec.url}`
}

// Run `body` against a fresh page on a server serving the local build. The
// server and browser come down together whatever `body` does.
export async function withHarness<T>(
  {
    port,
    chromeArgs = ['--enable-unsafe-swiftshader'],
    protocolTimeout,
    viewport,
    headless = true,
  }: {
    port: number
    // appended to BASE_CHROME_ARGS
    chromeArgs?: string[]
    protocolTimeout?: number
    viewport?: { width: number; height: number; deviceScaleFactor?: number }
    headless?: boolean
  },
  body: (ctx: { page: Page; browser: Browser }) => Promise<T>,
): Promise<T> {
  const server = await createTestServer(port, { jbrowseWebRoot, repoRoot })
  const browser = await launch({
    headless,
    executablePath: findChromeExecutable(),
    args: [...BASE_CHROME_ARGS, ...chromeArgs],
    ...(viewport ? { defaultViewport: viewport } : {}),
    ...(protocolTimeout === undefined ? {} : { protocolTimeout }),
  })
  try {
    return await body({ page: await browser.newPage(), browser })
  } finally {
    await browser.close()
    server.close()
  }
}
