import { navigateToApp } from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// The determinate branch of the job card had been repaired three times without
// anyone rendering it — c45b43aa2d most recently, where both ends of the
// fraction turned out to be dead code. `CurrentJobCard.test.tsx` renders it in
// jsdom now, which catches the wiring; what jsdom cannot see is the half that is
// actually CSS: a `color-mix()` track, a `scaleX` transform on the fill, and a
// keyframe sweep that exists only when there is no fraction. So render it in a
// browser.
//
// Jobs are produced by desktop text-indexing and this is jbrowse-web, but the
// widget is in web's core plugin set too and its model takes a job from
// anywhere. The chain from a real indexer's byte counts to `progressPct` has its
// own test (`indexJobsModel.test.ts`); what nothing had looked at is the
// drawing, and the drawing does not care where the job came from.

interface JobsWidget {
  addJob: (job: {
    name: string
    state: string
    statusMessage?: string
    progressPct?: number
  }) => void
  updateJobStatus: (name: string, statusMessage?: string, pct?: number) => void
}

interface SessionWithJobsWidget {
  widgets: Map<string, JobsWidget>
  addWidget: (type: string, id: string) => JobsWidget
  showWidget: (widget: JobsWidget) => void
}

const JOB_NAME = 'volvox names'

async function openJobsList(page: Page, progressPct?: number) {
  await page.evaluate(
    (name: string, pct: number | undefined) => {
      const session = (
        window as unknown as { JBrowseSession: SessionWithJobsWidget }
      ).JBrowseSession
      const widget =
        session.widgets.get('JobsList') ??
        session.addWidget('JobsListWidget', 'JobsList')
      session.showWidget(widget)
      widget.addJob({
        name,
        state: 'running',
        statusMessage: 'Indexing volvox_col',
        progressPct: pct,
      })
    },
    JOB_NAME,
    progressPct,
  )
  await page.waitForSelector(
    '[data-testid="job-progress"] [role="progressbar"]',
  )
}

function barState(page: Page) {
  return page.evaluate(() => {
    // scoped to the card: a display's loading overlay is a progressbar too
    const track = document.querySelector(
      '[data-testid="job-progress"] [role="progressbar"]',
    )
    if (!track?.firstElementChild) {
      throw new Error('no progress bar on the page')
    }
    const fill = getComputedStyle(track.firstElementChild)
    return {
      valueNow: track.getAttribute('aria-valuenow'),
      transform: fill.transform,
      animationName: fill.animationName,
      trackBackground: getComputedStyle(track).backgroundColor,
      // innerText, so this is a percent a reader can see rather than one in a
      // hidden node — and it is non-nullable, unlike textContent
      percentText: /\d+%/.exec(document.body.innerText)?.[0] ?? null,
    }
  })
}

const suite: TestSuite = {
  name: 'JobsListProgress',
  tests: [
    {
      name: 'a determinate job draws a filled bar and a percent',
      fn: async page => {
        await navigateToApp(page)
        await openJobsList(page, 42)
        const bar = await barState(page)

        if (bar.valueNow !== '42') {
          throw new Error(`aria-valuenow was ${bar.valueNow}, wanted 42`)
        }
        if (bar.percentText !== '42%') {
          throw new Error(`no "42%" on the card, found ${bar.percentText}`)
        }
        // scaled rather than sized: matrix(0.42, 0, 0, 1, 0, 0)
        if (!bar.transform.startsWith('matrix(0.42,')) {
          throw new Error(`fill transform was ${bar.transform}`)
        }
        if (bar.animationName !== 'none') {
          throw new Error(
            `a determinate bar is animating (${bar.animationName}); the sweep is for the other branch`,
          )
        }
        // `color-mix(in srgb, <primary> 26%, transparent)`. jsdom keeps the
        // declaration as written, so this is the only place it is known to
        // resolve rather than leaving the track invisible. Chrome reports it
        // back in the `color(srgb …)` form rather than `rgba()`, so the
        // assertion is "resolved and not transparent", not a spelling.
        if (
          bar.trackBackground.includes('color-mix') ||
          bar.trackBackground === 'transparent' ||
          bar.trackBackground === 'rgba(0, 0, 0, 0)'
        ) {
          throw new Error(
            `track background did not resolve to a visible color: ${bar.trackBackground}`,
          )
        }
      },
    },
    {
      name: 'a job with no fraction sweeps instead of sitting at zero',
      fn: async page => {
        await navigateToApp(page)
        await openJobsList(page)
        const bar = await barState(page)

        if (bar.valueNow !== null) {
          throw new Error(
            `an indeterminate bar announced ${bar.valueNow}; it should announce nothing`,
          )
        }
        if (bar.percentText !== null) {
          throw new Error(
            `a percent appeared with no fraction: ${bar.percentText}`,
          )
        }
        if (bar.animationName === 'none') {
          throw new Error('the indeterminate sweep is not running')
        }
      },
    },
    {
      name: 'the bar follows the job, not the render that created it',
      fn: async page => {
        await navigateToApp(page)
        await openJobsList(page, 97)

        // the ixIxx tail: the record stream ends, the label changes and the
        // fraction goes away. The bar has to let go of 97%.
        await page.evaluate((name: string) => {
          const session = (
            window as unknown as { JBrowseSession: SessionWithJobsWidget }
          ).JBrowseSession
          session.widgets
            .get('JobsList')!
            .updateJobStatus(name, 'Sorting and writing index')
        }, JOB_NAME)
        await page.waitForFunction(
          () =>
            !document
              .querySelector(
                '[data-testid="job-progress"] [role="progressbar"]',
              )
              ?.hasAttribute('aria-valuenow'),
          { timeout: 5000 },
        )

        const bar = await barState(page)
        if (bar.percentText !== null) {
          throw new Error(`the percent survived the phase: ${bar.percentText}`)
        }
        if (bar.animationName === 'none') {
          throw new Error('the bar went blank rather than indeterminate')
        }
      },
    },
  ],
}

export default suite
