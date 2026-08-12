// Guards the one thing that separates a gallery link from a screenshot url:
// a visitor clicks it.
//
// `sessionSpec` builds the urls the figure specs capture, and
// `gen-gallery-links.ts` bakes those same strings into
// `galleryLinks.generated.ts`, which the /gallery/ page resolves through
// `itemLiveHref`. So anything added to that builder for the benefit of a capture
// is also handed to every visitor, and the two want opposite things.
//
// That is not hypothetical. A `renderer=webgl` pin was added there so headless
// figure captures would keep rendering on WebGL — and it reached the gallery,
// where it forced WebGL on visitors whose machines software-rasterize, which is
// precisely the population `createGpuHal` steps around (a pin outranks its
// rasterizer check by design). It took two commits to undo, because the
// generated file had been regenerated from the pinned builder in between, so
// reverting the source left the artifact behind.
//
// **Freshness checks cannot catch this.** `pnpm autogen --check` asks whether
// the artifact matches its generator, and a pinned link matches perfectly — it
// is correctly generated from a builder with the wrong content. Only an
// assertion about what a link may *contain* sees it, which is this file.
//
// Checked through `itemLiveHref`, not over `galleryLinks.generated.ts` wholesale:
// the generated map holds an entry per screenshot spec (~300) while the page
// publishes far fewer (~40), and some of the unpublished ones legitimately carry
// capture-only parameters — `assembly_manager` and friends pass `&adminKey=` to
// screenshot the admin UI, which is correct for a capture and would be wrong to
// hand a visitor. Checking the map would have flagged those and invited an
// allowlist entry, which is how a guard like this stops guarding. Checking the
// published surface instead means adding one of those specs to `gallerySections`
// fails here, at the moment it becomes something a person can click.
import { gallerySections, itemLiveHref } from '../src/lib/gallery.ts'
import { reportProblems } from './check-utils.ts'

// The line is **what to show** versus **how the capture should behave**.
//
// `config`/`session`/`sessionName` are what `sessionSpec` builds; `hubURL` comes
// from a gallery item's own `session` override and is the point of the item that
// uses it ("a UCSC track hub opened from a hubURL parameter alone"). All four
// name content a visitor is meant to get.
//
// The two that have shown up on the other side of that line are `renderer`
// (pins a rendering backend, so the capture is reproducible — and so a visitor
// is forced onto hardware they may not have) and `adminKey` (turns on admin
// mode, correct for screenshotting the admin UI and wrong for everyone else).
//
// An allowlist rather than a denylist of those two on purpose: the next one will
// not be spelled `renderer` either. A new entry here should be a deliberate
// answer to "should a person clicking this from the website get it too?"
const ALLOWED_PARAMS = new Set(['config', 'session', 'sessionName', 'hubURL'])

const problems: string[] = []
const items = gallerySections.flatMap(section => section.items)
let checked = 0

for (const item of items) {
  // An external `href` is somebody else's url and none of this check's
  // business; `itemLiveHref` returns it verbatim.
  if (item.href) {
    continue
  }
  const href = itemLiveHref(item)
  if (href === undefined) {
    continue
  }
  const queryStart = href.indexOf('?')
  if (queryStart === -1) {
    continue
  }
  checked += 1
  for (const [param] of new URLSearchParams(href.slice(queryStart + 1))) {
    if (!ALLOWED_PARAMS.has(param)) {
      problems.push(
        `gallery item "${item.label}" publishes a link carrying "${param}=", ` +
          `which a website visitor would get. Capture-only parameters belong ` +
          `at capture time — \`pinRenderer\` in screenshot-ready.ts is where ` +
          `the renderer pin lives — never in \`sessionSpec\`, which feeds both ` +
          `the captures and this page.`,
      )
    }
  }
}

// A check that silently examines nothing passes forever. The page publishes
// dozens of live links; a collapse toward zero means the traversal above stopped
// finding them rather than that the corpus got clean.
if (checked < 20) {
  problems.push(
    `only ${checked} live gallery links were examined, which is too few to be ` +
      `the real page. The traversal probably stopped matching — fix it rather ` +
      `than deleting the guard.`,
  )
}

reportProblems(
  problems,
  `gallery links carry no capture-only parameters (${checked} checked)`,
)
