// One browser per capture: how it is launched, how its page is prepared, and
// when a failed capture is the page dying rather than the figure being wrong.
import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  isBrowserConsoleNoise,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { DEVICE_SCALE_FACTOR, firefox, headed } from './screenshot-options.ts'
import {
  describeNetwork,
  freezeAnimations,
  isFatalConsole,
  serveUrlOverrides,
  trackNetwork,
  trustCapturePlugins,
} from './screenshot-page.ts'
import { DEFAULT_VIEWPORT } from './screenshot-spec-types.ts'

import type { BrowserScreenshotSpec } from './screenshot-specs.ts'
import type { Browser, Page } from 'puppeteer'

// How long a page whose capture already failed gets to answer "are you still
// there". Slow and gone cost the same re-render once the ready wait is missed.
const LIVENESS_PROBE_MS = 5000

const defaultViewport = {
  ...DEFAULT_VIEWPORT,
  deviceScaleFactor: DEVICE_SCALE_FACTOR,
}

class FatalConsoleError extends Error {}

// Chrome leans on swiftshader for headless WebGL; Firefox needs WebGL forced
// on past the headless GL caveat so molstar's canvas renders at all.
function launchOptions() {
  return {
    headless: !headed,
    defaultViewport,
    // Puppeteer's 180s default applies to every CDP call, and a renderer
    // rasterizing a whole-genome canvas can starve the main thread past it.
    // Above the longest spec readyTimeout, so a real hang still fails as a
    // ready timeout with a debug frame rather than as a protocol error.
    protocolTimeout: 1200000,
    ...(firefox
      ? {
          browser: 'firefox' as const,
          extraPrefsFirefox: {
            'webgl.force-enabled': true,
            'webgl.disabled': false,
            'webgl.disable-fail-if-major-performance-caveat': true,
          },
        }
      : {
          executablePath: findChromeExecutable(),
          args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
        }),
  }
}

// A frame can look plausible while the page says it is broken (a display type
// that no longer registers, a menu builder that threw), so an uncaught error or
// a fatal console line fails the spec by name. `expectedConsole` exempts a spec
// whose subject is an error.
async function openPage(browser: Browser, spec: BrowserScreenshotSpec) {
  const page = await browser.newPage()
  await freezeAnimations(page)
  await trustCapturePlugins(page)
  await serveUrlOverrides(page)
  if (spec.viewportHeight || spec.viewportWidth) {
    await page.setViewport({
      ...defaultViewport,
      ...(spec.viewportWidth ? { width: spec.viewportWidth } : {}),
      ...(spec.viewportHeight ? { height: spec.viewportHeight } : {}),
    })
  }
  let fatal: string | undefined
  const report = (kind: string, text: string) => {
    const expected = spec.expectedConsole?.some(s => text.includes(s))
    if (!isBrowserConsoleNoise(text) && !expected) {
      const line = `browser[${kind}]: ${text.substring(0, 300)}`
      console.error(`    [${spec.name}] ${line}`)
      if ((kind === 'pageerror' || isFatalConsole(text)) && !fatal) {
        fatal = line
      }
    }
  }
  page.on('console', msg => {
    report(msg.type(), msg.text())
  })
  page.on('pageerror', (err: unknown) => {
    report('pageerror', err instanceof Error ? err.message : String(err))
  })
  return { page, net: trackNetwork(page), fatal: () => fatal }
}

// Puppeteer's `error` event is the renderer crashing. Racing it ends the
// attempt at once, instead of after every wait in flight runs out its timeout.
async function raceCrash<T>(page: Page, run: Promise<T>) {
  let crashed = false
  const crash = new Promise<never>((_, reject) => {
    page.once('error', err => {
      crashed = true
      reject(err)
    })
  })
  crash.catch(() => {})
  run.catch(() => {})
  try {
    return { ok: true as const, result: await Promise.race([run, crash]) }
  } catch (error) {
    return { ok: false as const, error, crashed }
  }
}

async function isAlive(page: Page) {
  return Promise.race([
    page.evaluate(() => true).catch(() => false),
    // unref'd, or the losing timer holds the event loop open after the last spec
    new Promise<boolean>(resolve => {
      setTimeout(() => {
        resolve(false)
      }, LIVENESS_PROBE_MS).unref()
    }),
  ])
}

// Run `body` on a page in a fresh browser (no service-worker cache carried
// between navigations). A page that died mid-capture, by crash or by failing
// the liveness probe, is retried once in a new browser: a dead renderer's
// selector timeout reads exactly like a display that never painted, so on a
// loaded machine it is most of what a long run would otherwise report.
export async function withFreshPage<T>(
  spec: BrowserScreenshotSpec,
  body: (page: Page) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const browser = await launch(launchOptions())
    try {
      const { page, net, fatal } = await openPage(browser, spec)
      const outcome = await raceCrash(page, body(page))
      if (outcome.ok) {
        const message = fatal()
        if (message !== undefined) {
          throw new FatalConsoleError(message)
        }
        return outcome.result
      }
      const { error, crashed } = outcome
      const alive = !crashed && (await isAlive(page))
      if (!alive && attempt === 0) {
        console.error(
          `    [${spec.name}] ${crashed ? 'renderer crashed' : 'page died'} mid-capture, retrying once in a fresh browser`,
        )
        continue
      }
      // On the error itself, so the diagnosis reaches the FAILURE SUMMARY, the
      // only part of a long concurrent run anyone reads.
      const died = alive ? '' : '\n  the page was gone when this was reported'
      throw error instanceof Error
        ? new Error(`${error.message}${describeNetwork(net)}${died}`, {
            cause: error,
          })
        : error
    } finally {
      await browser.close()
    }
  }
}
