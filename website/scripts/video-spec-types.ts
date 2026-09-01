// The shape of a tour, apart from the tours themselves: video-specs.ts assembles
// them out of scripts/videos/, and every one of those modules needs these two
// interfaces. Split out so importing a step type does not import all 47 specs
// and the whole spec-fixture graph behind them.
import type { ScreenshotAction } from './screenshot-spec-types.ts'

export interface VideoStep extends ScreenshotAction {
  // One short line held across the frame's lower centre while this step plays,
  // in the app's own words: a menu path, a control's label. It names what is
  // being done, the way a diagram's labels name its nodes.
  //
  // The line sets the step's hold as well as its words: a sentence is held long
  // enough to read, where a control's name is held for the beat a menu takes to
  // open.
  //
  // Use it where the app does not say it itself. A click lands in a quarter of a
  // second and a reader watching a cursor cross a toolbar has no way back to
  // which item it took, where a still has the whole cascade on the page at once.
  say?: string
  // Scroll the page to this offset, filmed, before the step's own action runs.
  // 'bottom' goes as far as the document does.
  //
  // The one motion in a tour that belongs to the reader: a launch adds a whole
  // view below the one it was launched from, and a window that held the first
  // does not hold both.
  scrollTo?: number | 'bottom'
  // ms to hold the finished frame before the next step runs. The default reads
  // a menu opening; raise it where the result needs looking at.
  hold?: number
  // How long a `drag` takes from press to release. The default reads as a
  // flick, which is right for a rubberband and wrong where the TRAVEL is the
  // subject: a pan the reader is meant to watch a second row keep pace with
  // has to move slowly enough that both rows are seen moving together.
  dragMs?: number
  // Take the camera off while this step's wait runs, and put it back when the
  // wait is over.
  //
  // For the steps that are genuinely slow: a subgraph cut refetches the tabix
  // index and hands a force layout to the remote FMMM engine, which is seconds
  // of spinner. A film of a spinner is not a film of anything, and speeding the
  // whole clip up to hide it makes every cursor movement look like a glitch.
  // The camera stays on for PRE_CUT_MS first, so the click is seen to start work
  // rather than teleporting to its result.
  cut?: boolean
  // Follow the tab this step opens, and film that from here on.
  //
  // For the one route that leaves the app: a launcher on another site hands the
  // reader a JBrowse session through a `target="_blank"` link, so the result
  // arrives as a second tab rather than as a navigation, and `page.screencast`
  // is bound to the page it was started on. Implies a cut, since what the new
  // tab opens with is a blank frame and then an app booting.
  opensTab?: boolean
}

export interface VideoSpec {
  // Output basename under website/static/media, directories allowed:
  // `pangenome/pggb_subgraph_launch` -> static/media/pangenome/pggb_subgraph_launch.mp4
  name: string
  // Session URL, the same form as a screenshot spec's: a query string served
  // against the local jbrowse-web build, or an absolute url.
  url: string
  // Capture viewport in CSS px. Filmed at deviceScaleFactor 1 — `page.screencast`
  // hands back frames at the viewport's CSS size whatever the page was laid out
  // at, so legibility in a docs column is bought by choosing this, and the
  // overlay's own type is sized against it.
  viewportWidth?: number
  viewportHeight?: number
  // Gates before the camera starts. Everything a tour opens with loads off
  // camera, so the first frame is the app ready rather than the app loading.
  readySelector?: string
  readyTimeout?: number
  settleMs?: number
  steps: VideoStep[]
  // Seconds into the finished clip to take the <video poster> from. Defaults to
  // the last frame, which is the state the tour ends in.
  posterAt?: number
  // Still frame held after the last step, so the end state can be read before
  // the clip ends.
  tailMs?: number
  // One line for `pnpm video --list`, and the sentence the doc embed's caption
  // is written from.
  description: string
}
