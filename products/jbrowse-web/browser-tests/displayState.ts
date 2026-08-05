import type { Page } from 'puppeteer'

// What the displays on the page are actually doing, for a `-done` wait that
// expired.
//
// Without it every timeout reads the same regardless of cause — which is the
// complaint `waitForDisplayPaint` already makes about the plain
// `waitForSelector` message ("the same sentence a broken adapter, an
// unreachable host and a renamed test-id all produce"). That function answers it
// for exactly one terminal state, `regionTooLarge`; this answers it for the
// rest, and the timeout mode is now the dominant browser-test failure.
//
// Three cases it separates:
//
//   no wrapper at all      -> the display never mounted: a config/track problem,
//                             a terminal state that replaces the subtree, or a
//                             renamed test-id
//   wrapper without -done  -> mounted, never finished its first paint; the
//                             phase tally says whether it is still fetching
//   -done present          -> it DID finish and the selector is wrong
//
// The last one earns this on its own: a selector typo and a hung display are
// indistinguishable today, and only one of them is a product bug.
//
// Lives in its own module because `helpers.ts` already imports from
// `snapshot.ts`, so the reverse import both of them need would be a cycle.
// Dependency-free for the same reason `canvasContent.ts` is.
export async function displayStateSummary(page: Page) {
  return page
    .evaluate(() => {
      const ids = [...document.querySelectorAll<HTMLElement>('[data-testid]')]
        .map(e => e.dataset.testid ?? '')
        .filter(id => id.includes('display') || id.includes('canvas'))
      const phases = [
        ...document.querySelectorAll<HTMLElement>('[data-display-phase]'),
      ].map(e => e.dataset.displayPhase ?? '')
      const tally = (xs: string[]) =>
        [...new Set(xs)].map(x => `${x}×${xs.filter(y => y === x).length}`)
      return (
        ` [displays: ${ids.length === 0 ? 'NONE mounted' : tally(ids).join(', ')}` +
        `; phases: ${
          phases.length === 0 ? 'none published' : tally(phases).join(', ')
        }]`
      )
    })
    .catch(() => ' [display state unavailable]')
}

// Whether a test-id is one whose timeout the summary above explains. Keeps it
// off the many waits for buttons, menus and inputs, where display state is
// noise rather than diagnosis.
export const isDisplaySelector = (s: string) =>
  s.includes('display') || s.includes('canvas')
