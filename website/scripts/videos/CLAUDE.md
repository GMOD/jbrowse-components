# website/scripts/videos

One module per topic, assembled by `../video-specs.ts`. What a tour is FOR, how
it is embedded, framed, pushed and gated is in `website/CLAUDE.md` § Videos.
Here: the things that go wrong inside a spec's `steps`, each of which cost a
refilm and none of which the run reports.

- **A radio menu item leaves its menu standing over the result it produced**,
  and nothing in the run says so — the app is the right height and the frame
  looks fine until you pull it with `ffmpeg -ss`. A `Display types` pick closes
  the cascade (`keepMenuOpen: false`, because the rows above it belong to the
  display being replaced); every other radio only writes a setting and stays up.
  Two Escapes reach it while focus is still in the list, then
  `waitForText hidden` on a row of each level says it happened. **Then blur**:
  the menu icon keeps focus, so its "Track settings" tooltip outlives the menu,
  and a `hover` elsewhere does not take a focus tooltip down — click
  `[aria-label="JBrowse"]`, a bare `<g>` with no handler, which parks the cursor
  clear of the tracks as well.
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
- **The camera opens with the pointer at the top middle of the frame**, which on
  a full-width LGV is the overview ruler — and the view writes the position
  under the pointer into its own title bar. So the opening frame carries a
  coordinate chip from wherever that lands, which is a locus the tour never
  visits. A first
  `{ type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 }` moves the
  real mouse off it; `moveCursor` drives `page.mouse.move`, so the drawn cursor
  and the hover states cannot disagree.
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
- **The camera parks the pointer at the top middle of the frame before it
  rolls**, and in a linear view that is the overview's cytoband strip -- so the
  opening frame of an LGV tour carries the band's own hover tooltip, over the
  view title, and nothing in the run says so. A first `hover` on
  `[aria-label="JBrowse"]` takes the pointer off it; the tooltip is gone by the
  time the tour's own first step runs.
- **A right-click anchored by locus lands on whatever the display DREW there**,
  which inside an alignment is often a CIGAR op rather than the feature. Over an
  indel wide enough to paint, the menu grows an "Open deletion details (N bp)"
  row above the items the tour is for -- the launch still works, since the menu
  is built from the feature either way, but the frame then shows a row the page
  never mentions. Move the locus onto a plain stretch of the block.
- **The caption chip is fixed 20px off the frame's BOTTOM, not off the app's.**
  A frame sized exactly to the app therefore puts every caption over the last
  ~56px of the last state, which is usually the half the caption is about (an
  empty mate panel, the bottom row of a stack). `video-report` allows 120px of
  slack before it says anything, so a frame with the chip's strip under the app
  reports clean.
- **A tour that PASTES its track films the defaults, not the figures' display.**
  A session spec pins a lane's height, its colour jexl and its labels; a pasted
  fence carries only what a reader would copy, so the lane arrives at the
  display's default height — which grew `pggb_subgraph_launch`'s frame by 50px
  the first time it was filmed this way — and in the default colour. Any claim
  the caption made about the lane and the graph pane sharing a ramp stops being
  true with it. The repair is in the FENCE or nowhere: `displayDefaults` reaches
  a slot a reader would sensibly set (`showLabels` off over a segment index
  whose names are GFA ids), and a ramp over the tour's own window is not one of
  those. `REJECTED_IDEAS.md` carries what that cost on the pggb page.
- **A display over its density gate still reports `ready`.** It is refusing to
  fetch, not failing to paint, so a tour that navigates from a gated window into
  a drawable one and waits on `displayReady(...)` carries on with the banner
  still on screen. What to wait on is the banner going away —
  `{ type: 'waitForText', text: 'Too many features', hidden: true }` — and the
  display id after it, for the paint. `pangenome/tier_to_fine` opens on that
  banner deliberately, which is the one case where it is the state the page
  describes rather than a spec pointed at the wrong locus.
- **A highlight whose span becomes the window washes the whole frame.** The
  graph's `Highlight in <assembly>` writes a translucent band into the linear
  view, which reads well while the band is a slice of the window and edge to
  edge once the tour has navigated onto it. Where the point is only WHERE the
  thing is, a `hover` is free: hovering a node syncs the same interval into the
  view above for as long as the pointer is on it, and leaves nothing behind.
- **A node's `Open in <assembly>` navigates the connected linear view rather
  than adding one** (the plugin pairs with the single view carrying that
  assembly when no launch created the pairing), so a tour built on it keeps the
  frame it opened at. That is what makes the coarse-to-fine route cheap to
  frame; launching a second graph pane at the end of it costs ~700px and lands
  on the drawing another clip already ends with.
