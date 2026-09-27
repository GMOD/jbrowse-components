# website/scripts/videos

One module per topic, assembled by `../video-specs.ts`. What a tour is FOR, how
it is embedded, framed, pushed and gated is in `website/CLAUDE.md` § Videos.
Here: the things that go wrong inside a spec's `steps`, each of which cost a
refilm and none of which the run reports.

- **A radio menu item leaves its menu standing over the result it produced.**
  The film fails when one is still open at the payoff, but nothing says so while
  it stands over the steps before it. A `Display types` pick closes the cascade
  (`keepMenuOpen: false`, because the rows above it belong to the display being
  replaced); every other radio only writes a setting and stays up.
  `leaveMenu(row)` in `shared.ts` takes the whole cascade down and blurs the
  menu icon, whose "Track settings" tooltip otherwise outlives the menu.
- **Escape leaves ONE level per press, and only from the top of MUI's modal
  stack.** Two of them work on a two-level cascade because the second lands back
  in the root `Menu`, which is the focus trap it came from. At THREE levels —
  `Color by...` then `Bisulfite / EM-seq` then the context radio — the second
  press lands on whatever MUI restored focus to, which is inside no modal, and
  the run dies at whichever `hidden` wait names the level that never closed.
  **One click on `.MuiBackdrop-root` takes the whole cascade at any depth**: the
  root menu is a plain MUI `Menu`, its backdrop spans the viewport, and every
  submenu is a React child of its list. The backdrop that click reaches is the
  root's, because a submenu's `HoverMenu` sets pointer-events none on its own
  modal root and its backdrop inherits that. It is still two clicks in a row,
  since the backdrop swallows the first: the second is the one that reaches
  `[aria-label="JBrowse"]` and blurs the menu icon.
- **The wordmark cannot BE the outside click.** `actions.ts` falls back to
  `node.click()` for a target something covers, and a menu's backdrop covers
  everything — but `click()` is on `HTMLElement`, and `[aria-label="JBrowse"]`
  is a bare SVG `<g>`, so the step throws `node.click is not a function` after
  the load and every step before it. It is the right place to park the cursor
  and the wrong thing to dismiss a menu with.
- **The camera parks the pointer on the wordmark while the goal is read**,
  because top centre is a full-width LGV's overview strip, and the view writes
  the locus under the pointer into its own title bar and syncs a hover band into
  a graph track below it. A page with no wordmark (a launcher on another site)
  still gets top centre.
- **A hold is where the pointer is, not where the click was.** The last click
  before a held end state leaves the pointer on whatever now occupies that spot,
  and a re-layout moves what that is: `Replace current view` sat where the
  breakpoint split view then drew a junction arc, so a clip held its panels for
  five seconds under a tooltip naming both ends of that arc by feature uuid. The
  harness parks the pointer on the wordmark before the payoff unless a `hover`
  precedes it; a hold mid-tour takes the same
  `{ type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 }` itself. A
  focus tooltip outlives a hover, so a menu icon still needs the first bullet's
  click.
- **A display-type switch does not carry the old display's height.**
  `replaceDisplay` builds the new one from its own config, so a multi-row
  painting arriving at the default height fits every row it discovers into the
  space one packed lane was using. A tour that films the switch pins the height
  in its own session — a `displays` array with the default form first, which is
  the shape a config guide prints anyway.
- **Check what the opening frame actually draws at the figures' locus.** A
  feature display stops above `maxFeatureScreenDensity` and paints "Too many
  features" instead, so a tour opening where the page's widest figure is taken
  can film that message rather than the state the page describes. Open narrower
  and let the tour navigate out, which also puts the reason the wide display
  exists into the clip.
- **The session comes from a `*VideoFixtures` bag in `../specs/`**, never
  written again here: a tour whose track config had drifted from the figures'
  would document a route through an app the rest of the page is not showing.
- **A `say` on a step that is `cut` reaches nothing.** The whole step is off
  camera, its `hold` included, so the chip is never filmed — and the caption cue
  is dropped too, because `captionTrack` times cues on the ON-CAMERA clock and a
  cut leaves that clock where it was, which makes the cue zero-length.
  `ui/bulk_add_tracks` shipped four captions for five `say` lines and no check
  saw it. Name the beat AFTER the cut instead, on a delay the camera is back
  for, which is also where the `hold` belongs.
- **One line per PHASE, not one per click.** A caption stays up until another
  step replaces it, so a cascade needs one line on its first step and silence
  after it. The line says what the phase does and why, in plain words --
  `Load the graph by URL from File, Open track` over **File → Open track... →
  the workflow select → Submit** -- since the labels themselves are already in
  the frame, under a 40px cursor and a red ripple. A line that is the menu item,
  the typed value or a track's name tells the viewer nothing the frame does not.
- **A `say` goes up when its step STARTS.** So a line describing what the step
  produces is wrong for the whole time it runs — `hic/two_regions` once said the
  wedge was chr9 against chr22 over a box that still held one window. The
  meaning goes on the PAYOFF: a `delay` after the result has drawn, whose line
  says what the frame now shows, written from the frame itself.
- **Nothing holds a `say` to a string the app draws.** `check-menu-labels` reads
  the doc pages, not the specs, so a line can name a control by its TESTID and
  the run is happy: `ui/add_genome` once put `Assembly name` over a field the
  form labels `Genome name`. Read the label out of the frame.
- **A gene search in GRCh38's MHC raises the results picker**, because the alt
  contigs carry the same genes: C4A has three hits and HLA-DRB1 six, with the
  primary chromosome's first. `pangenome/hprc_follow_view` films the pick, which
  is what a reader meets too.
- **A right-click anchored by locus lands on whatever the display DREW there**,
  which inside an alignment is often a CIGAR op rather than the feature. Over an
  indel wide enough to paint, the menu grows an "Open deletion details (N bp)"
  row above the items the tour is for -- the launch still works, since the menu
  is built from the feature either way, but the frame then shows a row the page
  never mentions. Move the locus onto a plain stretch of the block.
- **The caption chip is fixed 32px off the frame's BOTTOM, not off the app's,
  and centred.** A frame sized exactly to the app therefore puts every caption
  over the last ~100px of the last state -- the chip is 32px type in a 12px
  padding now, for the docs column rather than for the capture -- and that is
  usually the half the caption is about (an empty mate panel, the bottom row of
  a stack). `video-report` allows 120px of slack before it says anything, so a
  frame with the chip's strip under the app reports clean.
- **A tour that ADDS its track films the defaults, not the figures' display.** A
  session spec pins a lane's height, its colour jexl and its labels; a track
  added through the form carries only what the form writes, so the lane arrives
  at the display's default height — which grew `pggb_subgraph_launch`'s frame by
  50px the first time it was filmed this way — and in the default colour. Any
  claim the caption made about the lane and the graph pane sharing a ramp stops
  being true with it. The repair is in the FENCE or nowhere: `displayDefaults`
  reaches a slot a reader would sensibly set (`showLabels` off over a segment
  index whose names are GFA ids), and a ramp over the tour's own window is not
  one of those.
- **A display over its density gate still reports `ready`.** It is refusing to
  fetch, not failing to paint, so a tour that navigates from a gated window into
  a drawable one and waits on `displayReady(...)` carries on with the banner
  still on screen. What to wait on is the banner going away —
  `{ type: 'waitForText', text: 'Too many features', hidden: true }` — and the
  display id after it, for the paint. The film fails if a gated display is still
  on camera after any step, which is what a zoom to a whole chromosome meets on
  every gene lane.
- **A highlight whose span becomes the window washes the whole frame.** The
  graph's `Highlight in <assembly>` writes a translucent band into the linear
  view, which reads well while the band is a slice of the window and edge to
  edge once the tour has navigated onto it. Where the point is only WHERE the
  thing is, a `hover` is free: hovering a node syncs the same interval into the
  view above for as long as the pointer is on it, and leaves nothing behind.
- **A `graphNode` anchor resolves halfway along the node's drawn line.** It used
  to take the middle VERTEX, which for an anchored node's two-point line is its
  left end, where it meets its neighbour, and the app's hit test there answered
  the neighbour: `pangenome/hprc_browse` opened a 1 kb node beside the 1.8 kb
  allele it named. On a chromosome-scale tier a node is narrower than a pixel,
  so a click there can still land on the next one; cut the tier over a few
  megabases, and leave the chromosome-scale picture to a figure.
- **A node's `Open in <assembly>` navigates the linear view its graph track is
  in rather than adding one**, when that view carries the assembly, so a tour
  built on it keeps the frame it opened at. That is what makes the
  coarse-to-fine route cheap to frame: the view lands on the node's span and the
  track re-cuts from the fine index in place.
- **Don't end a tour by scrolling to text.** A panel of JSON or a table of
  values is the one thing a page does better than a film — the fence beside the
  clip is searchable, diffable and holds still — and the harness cannot aim at a
  line anyway. `scrollTo` scrolls the page, `scroll` scrolls horizontally, and
  the only lever inside a dialog's own field is a caret: a `PageDown` from where
  the click landed moved fifteen lines between two takes of
  `config/settings_to_json`, and a `PageDown` to the end is deterministic and
  stops one screen past the thing you wanted. That tour dropped the scroll and
  got shorter and clearer. Film the route; let the page carry what it produced.
- **An action that writes one setting can write another.** `setLinkedReads`
  nudges a `colorBy` still at `normal` to `insertSizeAndOrientation` as it
  enters chain mode, so a tour taking a page's settings in the order the page
  lists them filmed a menu being opened to pick a radio the app had already
  filled in — a click that changes nothing, reported as success. The frame that
  says so is the menu BEFORE the click: a radio already selected is the tell,
  and the fix is usually the ORDER, on the page as well as in the spec.
- **The run cannot see which state a tour is left standing in.**
  `PAGE BACKGROUND UNDER THE APP` measures the TALLEST state against the frame,
  so a tour that grows the app in the middle and shrinks back reports clean
  while its last frame — and the poster taken from it — is a third page
  background. `pggb_layout_switch` switched layout and switched back inside a
  frame sized to the taller drawing and shipped that way past every run it was
  ever in. Where two states differ by hundreds of pixels, END ON THE TALL ONE:
  the slack then falls at the opening, which is the shorter half of the clip and
  not the frame the poster comes from.
- **A purple chip with a number in it over a MAF row is a rendered insertion**,
  not a tooltip left standing — `drawMafInsertions` centres the inserted length
  in the marker once the row is tall enough for letters, and it does not move
  with the pointer. The page's own still of the same window is the cheapest way
  to tell a drawn feature from a hover artifact: pull the figure beside the
  frame before writing a step to clear something.
- **A tour that opens the track selector zooms every row out by the drawer's
  width.** An LGV holds its WINDOW in bp across a resize rather than its bp/px
  (`windowWidthBp` is the state and each later width divides into it), so the
  drawer's ~390px is a 25% zoom-out for everything in the frame — and a feature
  display sitting just under `maxFeatureScreenDensity` crosses it and paints
  "Too many features" for as long as the drawer is open.
  `synteny/three_strain_import` turned three whole-chromosome gene tracks on
  this way at 0.95 features per pixel, and the display's density ESTIMATE runs a
  few percent over the exact count, so a lane could stay on the banner after the
  drawer closed; it now zooms each row in once first. Nothing in the run says so
  — a gated display still reports `ready` — and the frame that shows it is one
  pulled with `ffmpeg -ss` from the drawer's own stretch rather than the last
  one. What keeps it honest is
  `{ type: 'waitForText', text: 'Too many features', hidden: true, cut: true }`
  after the drawer closes: it fails the run if the margin ever goes the other
  way, where a `waitForAppSettled` carries on and ships the payoff as three
  warnings.
- **The clip's last STATE CHANGE has to be the payoff, not just its last hold.**
  `website/CLAUDE.md`'s "the last repaint of a run of them does not reach the
  file" understates it: `page.screencast` writes through ffmpeg's stdin, and
  when `recorder.stop()` times out (the run logs
  `recorder.stop() -> TIMEOUT after 15s`, which is not one of the four things
  `video-report` names) whatever had not flushed is gone. On the first take of
  `genomes_basics/gnomad_filter` that was twelve seconds — the on-camera clock
  said 41s and the mp4 was 29s — and the twelve seconds were the ones that
  dismissed a menu the tour had reopened for one beat. So the clip ended on an
  open cascade and the poster was that cascade standing over the payoff, which
  is the exact frame the first bullet here is about. A tour that reopens a menu
  after its result has to do it in the MIDDLE, and there is usually no middle
  left: the affordance goes on the page instead, which is the division the
  corpus is built on anyway.
- **A beat can film a control doing nothing visible, and the run reports it as a
  step like any other.** `sv_cgiab/copy_number_layout` once set a manual min/max
  on the coverage lane because the page lists that as a bullet and because
  indexcov's spikes run to 497 — but those spikes are elsewhere in the genome,
  and on the chromosome the tour films local autoscale had already given the
  lane 0..2, so capping it to 0..3 barely moved the drawing. Nothing said so:
  the click landed, the wait passed, the report was clean. The caption written
  from the SPEC's reasoning then claimed a change the frames did not carry. Pull
  the frames on either side of the beat (`ffmpeg -ss`, one before the click and
  one after the repaint) and write the caption from those two pictures; where
  they are the same picture, move the tour to a window where the control bites,
  or cut the beat, as that tour did.
- **Size a dialog-centred tour to the DIALOG.** The run's content report
  measures app height only, so it will tell you to shrink a frame the dialog
  needs. Pull a mid-clip frame with `ffmpeg -ss` and look.
- **`cut: true` on a `type` step** is how a paste is filmed. Five URLs typed a
  keystroke at a time read as 9.4s of nothing happening.
- **Don't film a reader reading.** A tour that ends by scrolling a text panel to
  the line that matters is filming the one thing a page does better: the fence
  beside the clip is searchable, diffable and holds still.
  `config/settings_to_json` spent three takes trying to land a 20-row JSON panel
  on four keys before dropping the scroll entirely, and the clip got shorter and
  clearer for it. A clip carries the route; the page carries the text the route
  produced.
- **A menu path a page prints is a claim, and a `waitForText` is what checks
  it.** Two of the first four page defects tours found were levels missing from
  a cascade, and both showed up as a step dying by name rather than as anything
  anyone read. Write the path the page prints, not the path you verified in the
  source, and let the run disagree.
- **Check whether the app already did the next step for you.** An action that
  writes one setting can nudge another (`setLinkedReads` sets `colorBy` on the
  way into chain mode), so a tour taking a page's bullets in order can film a
  click that changes nothing and report success. The frame to pull is the menu
  BEFORE the click: a radio already filled in is the tell.
