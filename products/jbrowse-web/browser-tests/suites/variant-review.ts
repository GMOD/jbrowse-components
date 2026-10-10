import {
  delay,
  findByTestId,
  findByText,
  navigateToUrl,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { KeyInput, Page } from 'puppeteer'

// The variant-review loop driven from the keyboard, as a reviewer would: start
// from the variant track's menu, then only keys. State assertions, no golden
// image — what matters is that every alignments display is sorted at the
// candidate's column on every `j`, and that decisions and the cursor survive a
// reload.

interface SortedBy {
  type: string
  pos: number
  refName: string
}

interface LiveView {
  id: string
  width: number
  pxToBp: (px: number) => { refName: string; offset: number; start: number }
  tracks: {
    configuration: { trackId: string }
    displays: { type: string; sortedBy?: SortedBy; layoutOrder: string }[]
  }[]
  reviewActive: boolean
  reviewCursorId?: string
  candidateIndex: number
  candidateCount: number
  currentCandidate?: {
    id: string
    refName: string
    sort?: { type: string; pos: number }
  }
  decisionCounts: Record<string, number>
  reviewDecisions: { size: number }
  stopReview: () => void
}

interface LiveWindow {
  JBrowseSession: { views: LiveView[] }
}

const tumourNormal = (alignmentTracks: string[]) => ({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-5000',
      tracks: ['volvox_filtered_vcf', ...alignmentTracks],
    },
  ],
})

async function startReviewFromTrackMenu(page: Page) {
  // the variant track is the first track, so its menu is the first one
  const menuIcon = await findByTestId(page, 'track_menu_icon', 30000)
  await menuIcon.click()
  const item = await findByText(page, 'Review variants in this track', 10000)
  await item.click()
  await page.waitForFunction(
    () => {
      const view = (window as unknown as LiveWindow).JBrowseSession.views[0]
      return !!view?.reviewActive && view.candidateCount > 0
    },
    { timeout: 60000 },
  )
}

async function cursorIndex(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as LiveWindow).JBrowseSession.views[0]!.candidateIndex,
  )
}

async function press(page: Page, key: KeyInput) {
  const before = await cursorIndex(page)
  await page.keyboard.press(key)
  if ('jkn'.includes(key)) {
    await page
      .waitForFunction(
        b =>
          (window as unknown as LiveWindow).JBrowseSession.views[0]!
            .candidateIndex !== b,
        { timeout: 5000 },
        before,
      )
      .catch(() => {})
  }
  await delay(50)
}

// Every alignments display sorted at the candidate's column, and the view
// centred within a base of it.
async function assertSortedAtCandidate(page: Page, expectedTargets: number) {
  const problem = await page.evaluate(n => {
    const view = (window as unknown as LiveWindow).JBrowseSession.views[0]!
    const c = view.currentCandidate
    if (!c?.sort) {
      return `no current candidate with a sort column (${c?.id})`
    }
    const displays = view.tracks
      .flatMap(t => t.displays)
      .filter(d => d.type === 'LinearAlignmentsDisplay')
    if (displays.length !== n) {
      return `expected ${n} alignments displays, found ${displays.length}`
    }
    for (const d of displays) {
      const s = d.sortedBy
      if (
        s?.type !== c.sort.type ||
        s.pos !== c.sort.pos ||
        s.refName !== c.refName
      ) {
        return `display sortedBy ${JSON.stringify(s)} != ${JSON.stringify({ ...c.sort, refName: c.refName })}`
      }
    }
    const centre = view.pxToBp(view.width / 2)
    const centreBp = centre.start + centre.offset
    if (
      centre.refName !== c.refName ||
      Math.abs(centreBp - (c.sort.pos + 0.5)) > 1
    ) {
      return `view centre ${centre.refName}:${centreBp} is not on ${c.refName}:${c.sort.pos}`
    }
    return undefined
  }, expectedTargets)
  if (problem) {
    throw new Error(problem)
  }
}

async function liveState(page: Page) {
  return page.evaluate(() => {
    const view = (window as unknown as LiveWindow).JBrowseSession.views[0]!
    return {
      cursor: view.reviewCursorId,
      index: view.candidateIndex,
      counts: { ...view.decisionCounts },
      decisionCount: view.reviewDecisions.size,
      sorts: view.tracks
        .flatMap(t => t.displays)
        .filter(d => d.type === 'LinearAlignmentsDisplay')
        .map(d => ({ sortedBy: d.sortedBy, layoutOrder: d.layoutOrder })),
    }
  })
}

const suite: TestSuite = {
  name: 'Variant Review',
  tests: [
    {
      name: 'keyboard review sorts every alignments track and survives reload',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          tumourNormal(['volvox_bam', 'volvox_cram']),
        )
        await waitForDataLoaded(page)
        const before = await liveState(page)
        await startReviewFromTrackMenu(page)
        await assertSortedAtCandidate(page, 2)

        const decisions: KeyInput[] = ['a', 'r', 'f']
        for (let i = 0; i < 10; i++) {
          await press(page, 'j')
          await assertSortedAtCandidate(page, 2)
          if (i % 2 === 0) {
            await press(page, decisions[(i / 2) % 3]!)
          }
        }
        const afterJ = await cursorIndex(page)
        if (afterJ !== 10) {
          throw new Error(
            `expected cursor at 10 after ten j presses, got ${afterJ}`,
          )
        }
        await press(page, 'k')
        if ((await cursorIndex(page)) !== 9) {
          throw new Error('k did not move back one candidate')
        }
        await assertSortedAtCandidate(page, 2)
        // the first candidate has no decision; n wraps round to it
        await press(page, 'n')
        await assertSortedAtCandidate(page, 2)

        const state = await liveState(page)
        const { accepted, rejected, flagged } = state.counts
        if (accepted !== 2 || rejected !== 2 || flagged !== 1) {
          throw new Error(`unexpected counts ${JSON.stringify(state.counts)}`)
        }

        // reload from the saved session
        const snapshot = await page.evaluate(() =>
          JSON.parse(
            JSON.stringify((window as unknown as LiveWindow).JBrowseSession),
          ),
        )
        await navigateToUrl(
          page,
          `config=test_data/volvox/config.json&session=${encodeURIComponent(
            `json-${JSON.stringify({ session: snapshot })}`,
          )}`,
        )
        await page.waitForFunction(
          () => {
            const view = (window as unknown as LiveWindow).JBrowseSession
              .views[0]
            return !!view?.reviewActive && view.candidateCount > 0
          },
          { timeout: 60000 },
        )
        const reloaded = await liveState(page)
        if (
          reloaded.cursor !== state.cursor ||
          JSON.stringify(reloaded.counts) !== JSON.stringify(state.counts)
        ) {
          throw new Error(
            `reload lost review state: ${JSON.stringify(reloaded)} vs ${JSON.stringify(state)}`,
          )
        }

        // stopping puts each track's sort back the way it was
        await page.evaluate(() => {
          ;(
            window as unknown as LiveWindow
          ).JBrowseSession.views[0]!.stopReview()
        })
        const stopped = await liveState(page)
        if (JSON.stringify(stopped.sorts) !== JSON.stringify(before.sorts)) {
          throw new Error(
            `prior sort not restored: ${JSON.stringify(stopped.sorts)} vs ${JSON.stringify(before.sorts)}`,
          )
        }
        // the counts are over the (now unloaded) list; the decisions are not
        if (stopped.decisionCount !== state.decisionCount) {
          throw new Error('stopping review lost decisions')
        }
      },
    },
    {
      // the BAM names the contig `contigA`; the sort must name the view's
      // canonical `ctgA` or it is a silent no-op
      name: 'review sorts an aliased-refName alignments track',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          tumourNormal(['volvox_bam_altname']),
        )
        await waitForDataLoaded(page)
        await startReviewFromTrackMenu(page)
        await assertSortedAtCandidate(page, 1)
        await press(page, 'j')
        await assertSortedAtCandidate(page, 1)
      },
    },
  ],
}

export default suite
