// What each spec mode does to produce its PNG and where the PNG lands. A run
// commits `render`'s output; --check renders twice and diffs, committing nothing.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { commitScreenshot, optimizePng } from './image-pipeline.ts'
import { arrangeFrames } from './screenshot-arrange.ts'
import { withFreshPage } from './screenshot-browser.ts'
import { captureEmbeddedToTemp } from './screenshot-embedded.ts'
import {
  diffThreshold,
  forceCommit,
  jb2exportBin,
  jbrowseImgDir,
  jbrowseImgOutDir,
  outDir,
  servePort,
  tempPath,
} from './screenshot-options.ts'
import { renderUrlSpecToTemp } from './screenshot-url.ts'

import type { CommitResult } from './image-pipeline.ts'
import type {
  BrowserScreenshotSpec,
  CliSpec,
  ComposeSpec,
  ScreenshotSpec,
} from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

const execFileAsync = promisify(execFile)

type Mode = ScreenshotSpec['mode']
type SpecOf<M extends Mode> = Extract<ScreenshotSpec, { mode: M }>

interface Renderer<S extends ScreenshotSpec> {
  // one finished, optimized PNG in a temp file; `suffix` keeps the two
  // captures of a --check run apart
  render: (spec: S, suffix: string) => Promise<string>
  // move it into place under the diff gate
  commit: (spec: S, renderPath: string) => CommitResult
}

export function specThreshold(spec: ScreenshotSpec) {
  return spec.diffThreshold ?? diffThreshold
}

// `commitScreenshot` removes the temp file itself; the rm covers a mkdir or a
// diff that throws first.
function commitTemp(
  renderPath: string,
  outputPath: string,
  spec: ScreenshotSpec,
) {
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    return commitScreenshot(renderPath, outputPath, spec.name, {
      force: forceCommit,
      diffThreshold: specThreshold(spec),
      baseThreshold: diffThreshold,
    })
  } finally {
    fs.rmSync(renderPath, { force: true })
  }
}

function commitToOutDir(spec: ScreenshotSpec, renderPath: string) {
  return commitTemp(renderPath, path.join(outDir, `${spec.name}.png`), spec)
}

function inBrowser<S extends BrowserScreenshotSpec>(
  render: (page: Page, spec: S, suffix: string) => Promise<string>,
): Renderer<S> {
  return {
    render: (spec, suffix) =>
      withFreshPage(spec, page => render(page, spec, suffix)),
    commit: commitToOutDir,
  }
}

// Copy only when the bytes differ, so an unchanged figure doesn't churn.
function mirrorFile(src: string, dest: string) {
  if (fs.existsSync(src)) {
    const upToDate =
      fs.existsSync(dest) && fs.readFileSync(dest).equals(fs.readFileSync(src))
    if (!upToDate) {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(src, dest)
    }
  }
}

// jb2export renders through React SSR, no browser. Its output is the
// jbrowse-img README's copy; the website and the review UI read the mirror
// under outDir, which `pnpm autogen` would otherwise refresh only for
// README-referenced names.
const cli: Renderer<CliSpec> = {
  async render(spec, suffix) {
    const renderPath = tempPath('jb-img', spec.name, suffix)
    await execFileAsync(
      'node',
      [
        '--experimental-strip-types',
        jb2exportBin,
        ...spec.args,
        '--out',
        renderPath,
      ],
      { cwd: jbrowseImgDir, maxBuffer: 1024 * 1024 * 64 },
    )
    optimizePng(renderPath)
    return renderPath
  },
  commit(spec, renderPath) {
    const baseName = spec.name.replace(/^jbrowse-img\//, '')
    const outputPath = path.join(jbrowseImgOutDir, `${baseName}.png`)
    const result = commitTemp(renderPath, outputPath, spec)
    mirrorFile(outputPath, path.join(outDir, `${spec.name}.png`))
    return result
  },
}

// Arranges the committed PNGs of `spec.parts`, so it runs after the pool that
// refreshes them.
const compose: Renderer<ComposeSpec> = {
  async render(spec, suffix) {
    const partPaths = spec.parts.map(part => path.join(outDir, `${part}.png`))
    const missing = spec.parts.filter((_, i) => !fs.existsSync(partPaths[i]!))
    if (missing.length > 0) {
      throw new Error(`missing part image(s): ${missing.join(', ')}`)
    }
    const renderPath = tempPath('jb-compose', spec.name, suffix)
    await arrangeFrames(partPaths, renderPath, spec)
    optimizePng(renderPath)
    return renderPath
  },
  commit: commitToOutDir,
}

const renderers: { [M in Mode]: Renderer<SpecOf<M>> } = {
  url: inBrowser((page, spec, suffix) =>
    renderUrlSpecToTemp(page, spec, servePort, suffix),
  ),
  embedded: inBrowser(captureEmbeddedToTemp),
  cli,
  compose,
}

export function rendererFor<S extends ScreenshotSpec>(spec: S) {
  return renderers[spec.mode] as Renderer<S>
}
