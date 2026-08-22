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
