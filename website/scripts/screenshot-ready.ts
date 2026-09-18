// Getting a page to the state a figure is supposed to show, and knowing when it
// is there. The gates are @jbrowse/capture's: the census says the session holds
// what the spec asked for, and the frame gate holds `[data-app-phase="ready"]`
// and waits for every display to paint.
import {
  assemblyFromSession,
  trackIdsFromSession,
  waitForFrame,
  waitForSession,
} from '@jbrowse/browser-test-utils'

import { textSelector, waitForVisible } from './actions.ts'
import {
  debugDump,
  declaredSession,
  markPageAlive,
} from './screenshot-asserts.ts'

import type {
  BrowserScreenshotSpec,
  EmbeddedSpec,
  SessionUrlSpec,
} from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

// Here rather than in screenshot-options.ts, because importing that module
// parses process.argv, and generate-video.ts takes other flags.
const DEFAULT_READY_TIMEOUT_MS = 30000

// The ceiling for every wait a spec is subject to. readyText is only the track
// label (present well before a slow remote BAM finishes), so a spec that says it
// needs longer gets that everywhere — the fixed default otherwise cut off slow
// whole-genome-alignment blocks mid-load and captured a "Loading" panel.
function readyTimeoutOf(spec: BrowserScreenshotSpec) {
  return spec.readyTimeout ?? DEFAULT_READY_TIMEOUT_MS
}

// What the census has to show before the frame gate means anything: the
// assembly and trackIds the spec's own session opens. A spec that opens no view
// (an assembly-manager or import-dialog figure) or loads a config's default
// session declares nothing to check, so there only the session has to exist.
function sessionExpectations(spec: SessionUrlSpec | EmbeddedSpec) {
  if (spec.mode === 'embedded') {
    return {}
  }
  const session = declaredSession(spec)
  return session && Array.isArray(session.views) && session.views.length > 0
    ? {
        assembly: assemblyFromSession(session),
        trackIds: trackIdsFromSession(session),
      }
    : { views: 0 }
}

// The marker held, every display painted, and nothing canceled or unpainted —
// the gate after anything that changes the frame, a click or a resize as much
// as a navigation. `allowUnsettled` takes the frame as it stands.
export async function waitForSpecFrame(
  page: Page,
  spec: BrowserScreenshotSpec,
) {
  try {
    await waitForFrame(page, {
      timeout: readyTimeoutOf(spec),
      allowUnsettled: spec.allowUnsettled,
    })
  } catch (e) {
    await debugDump(page, spec.name)
    throw e
  }
}

export async function waitForReady(
  page: Page,
  spec: SessionUrlSpec | EmbeddedSpec,
): Promise<void> {
  const timeout = readyTimeoutOf(spec)
  const readySelectors = [
    spec.readyText ? textSelector(spec.readyText) : undefined,
    spec.readySelector,
  ].filter((s): s is string => s !== undefined)
  if ('noSession' in spec && spec.noSession) {
    await waitForPlainPage(page, spec, readySelectors)
    return
  }
  try {
    await waitForSession(page, { ...sessionExpectations(spec), timeout })
    for (const selector of readySelectors) {
      await waitForVisible(page, selector, { timeout })
    }
  } catch (e) {
    await debugDump(page, spec.name)
    throw e
  }
  await waitForSpecFrame(page, spec)
}

async function waitForPlainPage(
  page: Page,
  spec: SessionUrlSpec,
  readySelectors: string[],
) {
  const timeout = readyTimeoutOf(spec)
  try {
    if (readySelectors.length === 0) {
      throw new Error(
        `${spec.name}: a noSession spec needs readyText or readySelector, ` +
          'which is the only positive signal such a page has',
      )
    }
    for (const selector of readySelectors) {
      await waitForVisible(page, selector, { timeout })
    }
    await page.waitForNetworkIdle({ idleTime: 500, timeout })
  } catch (e) {
    await debugDump(page, spec.name)
    throw e
  }
}

/**
 * Pin a capture to WebGL. Every figure is rendered headless, headless Chrome is
 * SwiftShader, and `createGpuHal` steps over a software rasterizer — so without
 * this a regen silently redraws the whole corpus on Canvas2D, a real visual
 * change across every figure arriving as a side effect of a rendering decision.
 * Moving the corpus to another backend should be a deliberate edit here.
 *
 * **Applied at capture, never in the url builder.** `sessionSpec` builds these
 * same urls and has a second consumer — `gen-live-links.ts` bakes them into
 * the doc figures, where a pin would force WebGL on the very visitors the
 * ladder exists to route away from it. That is not hypothetical: it shipped, to
 * 251 links, and took two commits to undo.
 */
export function pinRenderer(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}renderer=webgl`
}

export async function captureUrl(
  page: Page,
  spec: SessionUrlSpec,
  port: number,
) {
  const fullUrl = spec.url.startsWith('http')
    ? spec.url
    : `http://localhost:${port}/${spec.url}`
  await page.goto(pinRenderer(fullUrl), {
    waitUntil:
      spec.waitUntil ??
      (spec.url.startsWith('http') ? 'domcontentloaded' : 'networkidle0'),
    // networkidle0 can't be reached while a spec's data is still streaming, so a
    // fixed 60s here failed the heavy tcga specs as a *navigation* timeout —
    // nothing to do with the page being broken. A spec that already declares it
    // needs longer to be ready gets the same room for its navigation.
    timeout: Math.max(60000, spec.readyTimeout ?? 0),
  })

  await waitForReady(page, spec)
  await markPageAlive(page)
}
