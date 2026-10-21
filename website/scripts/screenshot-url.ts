// The `mode: 'url'` capture: load a jbrowse-web session, run the spec's
// actions, and shoot one frame or arrange several stages into one.
import fs from 'node:fs'

import { clearAnnotations, drawAnnotations } from '@jbrowse/browser-test-utils'

import { delay, runAction } from './actions.ts'
import { optimizePng } from './image-pipeline.ts'
import { arrangeFrames } from './screenshot-arrange.ts'
import {
  assertRenderSettled,
  assertSamePageAsReady,
  assertViewsPresent,
  assertViewsRendered,
  debugDump,
} from './screenshot-asserts.ts'
import { tempPath } from './screenshot-options.ts'
import { waitForRasterize } from './screenshot-page.ts'
import { captureUrl, waitForSpecFrame } from './screenshot-ready.ts'
import {
  recordOverflow,
  recordTooltip,
  recordUnpainted,
} from './screenshot-report.ts'
import { hideLingeringTooltip } from './tooltips.ts'

import type {
  Annotation,
  ScreenshotAction,
  ScreenshotStage,
  SessionUrlSpec,
} from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

// The pre-shot steps every frame gets, then the screenshot straight to `file`.
async function shoot(
  page: Page,
  spec: SessionUrlSpec,
  annotations: Annotation[] | undefined,
  file: string,
) {
  if (spec.tooltip === 'hide') {
    await hideLingeringTooltip(page)
  } else {
    await recordTooltip(page, spec.name)
  }
  if (spec.hideSelectors && spec.hideSelectors.length > 0) {
    await page.evaluate(selectors => {
      for (const sel of selectors) {
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          el.style.display = 'none'
        }
      }
    }, spec.hideSelectors)
  }
  if (annotations && annotations.length > 0) {
    await drawAnnotations(page, annotations)
  } else {
    await clearAnnotations(page)
  }
  await waitForRasterize(page)
  await recordUnpainted(page, spec.name)
  await assertSamePageAsReady(page, spec)
  await page.screenshot({ path: file, clip: spec.crop })
  if (!spec.crop) {
    await recordOverflow(page, spec.name)
  }
}

async function runActions(
  page: Page,
  name: string,
  actions: ScreenshotAction[] | undefined,
) {
  for (const action of actions ?? []) {
    await runAction(page, action).catch(async (e: unknown) => {
      await debugDump(page, name)
      throw e
    })
  }
}

// Escape is a no-op on a JBrowse menu cascade, while one click on its backdrop
// takes the whole cascade down. Only backdrops of a modal holding a menu are
// clicked, so a dialog the spec opened stays. Asserted at the end: a stage that
// cannot reach a clean slate must say so rather than act on the old menu.
async function closeOpenMenus(page: Page, name: string) {
  const clickMenuBackdrops = () =>
    page.evaluate(() => {
      for (const modal of document.querySelectorAll('.MuiModal-root')) {
        const backdrop = modal.querySelector<HTMLElement>('.MuiBackdrop-root')
        if (modal.querySelector('[role="menu"]') && backdrop) {
          backdrop.click()
        }
      }
    })
  const openMenus = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll('[role="menu"]')].filter(el => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        }).length,
    )

  for (let attempt = 0; attempt < 5 && (await openMenus()) > 0; attempt++) {
    await clickMenuBackdrops()
    await delay(200)
  }
  const left = await openMenus()
  if (left > 0) {
    throw new Error(`closeMenusFirst: ${left} menu(s) still open in ${name}`)
  }
}

// The spec a stage is readied and asserted against: one with a `url` of its
// own brings its own view tree and ready gate.
function specForStage(
  spec: SessionUrlSpec,
  stage: ScreenshotStage,
): SessionUrlSpec {
  return stage.url
    ? {
        ...spec,
        url: stage.url,
        readySelector: stage.readySelector ?? spec.readySelector,
        readyText: undefined,
      }
    : spec
}

async function setViewportHeight(page: Page, height: number) {
  const viewport = page.viewport()
  if (viewport && viewport.height !== height) {
    await page.setViewport({ ...viewport, height })
    // setViewport resolves on the CDP call, not on the page's re-layout
    await page.waitForFunction(h => window.innerHeight === h, {}, height)
  }
}

async function captureStage(
  page: Page,
  spec: SessionUrlSpec,
  stage: ScreenshotStage,
  file: string,
  port: number,
) {
  const stageSpec = specForStage(spec, stage)
  // A stage with its own session loads it at the frame's height, so a RESULT
  // frame is declared as a session rather than clicked together.
  if (stage.url) {
    const viewport = page.viewport()
    if (stage.viewportHeight && viewport) {
      await page.setViewport({ ...viewport, height: stage.viewportHeight })
    }
    await captureUrl(page, stageSpec, port)
  }
  if (stage.closeMenusFirst) {
    await closeOpenMenus(page, spec.name)
  }
  // so the previous stage's callout text can't match this stage's ::-p-text()
  await clearAnnotations(page)
  await runActions(page, spec.name, stage.actions)
  if (stage.closeMenusAfter) {
    await closeOpenMenus(page, spec.name)
  }
  // After the actions, which usually act on chrome the previous stage opened
  // and a resize would move or dismiss.
  if (stage.viewportHeight) {
    await setViewportHeight(page, stage.viewportHeight)
  }
  await waitForSpecFrame(page, spec)
  await shoot(page, spec, stage.annotations, file)
  // per stage, since the staged frames ARE the published image
  await assertViewsPresent(page, stageSpec)
  await assertViewsRendered(page, spec.name)
}

async function captureStages(
  page: Page,
  spec: SessionUrlSpec,
  stages: ScreenshotStage[],
  renderPath: string,
  port: number,
) {
  const stageFiles = stages.map((_, i) =>
    tempPath('jb-shot', spec.name, `-${i}`),
  )
  try {
    for (const [i, stage] of stages.entries()) {
      await captureStage(page, spec, stage, stageFiles[i]!, port)
    }
    await arrangeFrames(stageFiles, renderPath, spec)
  } finally {
    for (const f of stageFiles) {
      fs.rmSync(f, { force: true })
    }
  }
}

// Drive the page through the spec to one finished, optimized PNG in a temp
// file. `suffix` keeps the two captures of a --check run apart.
export async function renderUrlSpecToTemp(
  page: Page,
  spec: SessionUrlSpec,
  port: number,
  suffix: string,
) {
  await captureUrl(page, spec, port)
  if (spec.actions?.length) {
    await runActions(page, spec.name, spec.actions)
    await waitForSpecFrame(page, spec)
  }
  await assertViewsPresent(page, spec)
  await assertViewsRendered(page, spec.name)
  if (!spec.allowUnsettled) {
    await assertRenderSettled(page, spec)
  }
  const renderPath = tempPath('jb-final', spec.name, suffix)
  if (spec.stages && spec.stages.length > 0) {
    await captureStages(page, spec, spec.stages, renderPath, port)
  } else {
    await shoot(page, spec, spec.annotations, renderPath)
  }
  optimizePng(renderPath)
  return renderPath
}
