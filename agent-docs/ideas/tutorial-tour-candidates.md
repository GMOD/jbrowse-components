---
name: tutorial-tour-candidates
description: Nineteen tutorial pages whose route a figure cannot carry, ranked by the prose each tour would delete over the risk of filming it, plus the fifteen untoured pages that should NOT get one and why. Sixteen are filmed and their entries record what each estimate got wrong; what is left is 14, 18 and 19. Read before writing a video spec for a tutorial.
audience: internal
---

# Tutorial tours worth filming

**Colin's standing preference: film the TUTORIALS before the user guides.** The
three tours filmed on 2026-08-21 were two user guides and a quickstart, which is
the wrong end of the corpus to have started at. `tutorial-tours-from-scratch.md`
holds the remaining user-guide proposals and the harness analysis; this file is
the tutorial half and is the one to work from.

Coverage: **26 of 43 tutorials carry a tour** — `allvsall_synteny`,
`analyze_trio`, `bisulfite`, `bxd_qtl`, `cancer_sv`, `chromhmm`,
`display_settings`, `dog10k_selection`, `genomes_basics` (2),
`genomes_proteins` (3), `genomes_synteny`, `hg002_haplotypes`,
`hic_structural_variants`, `mcscan_synteny_grape_peach`, `methylation`,
`multiway_synteny_grape_peach_cacao`, `pangenome_cactus`, `pangenome_ecoli` (4),
`pangenome_hprc` (2), `repeatmasker_classes`, `sv_callset_review`,
`sv_multisamples`, `sv_visualization_cgiab`, `synteny_visualization`,
`tcga_cohort_cnv`, `tcga_cohort_mutations`. The other 17 do not.

**Count it, don't carry it forward.** This line has been wrong three times, and
the third was the grep itself: `website/docs/tutorials/CLAUDE.md` matches the
glob and carries no `<Video>`, so it counted as an untoured tutorial. It is
`grep -L '<Video ' website/docs/tutorials/*.md | grep -v CLAUDE`.

**Sixteen candidates are filmed and landed** on 2026-08-21 — 1 to 13 and 15 to
17, one clip serving two pages for 3. Their entries stay below with what each
actually cost and what it corrected, because the next tour on those pages starts
from them.

Every candidate below came out of the ten-agent tutorial audit
(`tutorial-structure-audit.md` is that audit's structural half). Each names the
prose it makes unnecessary, which is what ranks it.

**A tour does not retire a figure.** Two were retired on 2026-08-21 and put back
the same day: Colin's call is that the stills and the clips both stay, so
"deletes a figure" is not a point in a candidate's favour and not a step in
filming one. What a clip can shorten is PROSE — a paragraph of sequential clicks,
a section that only introduces the next state. `video-specs.ts` states the reason
in its own header: a figure is searchable, diffable, annotatable and readable at a
glance, and none of that survives being filmed.

## The four that were first, all done

**1. `variants/trio_phased_matrix` — `tutorials/analyze_trio.md`**

`Display types → Multi-sample variant display (matrix)`, then
`Rendering mode → Phased`, ending on the six haplotype rows.

The highest value/risk ratio in the corpus. The page spends **three `##`
sections and four figures** on one two-click route — `trio-basic`,
`trio-matrix`, `trio-matrix-phased`, `trio-matrix-phased-clean` — each a result
staged as its own cause. One clip retires three of the four and the two sections
that introduce them.

**Filmed.** `videos/variants.ts`, 620px frame, 38s. What the estimate got wrong:

- **It retires none of the four.** Two were dropped and restored the same day;
  see the rule above. All four stills stay, the clip sits under the phased one,
  and the three sections stay as they were.
- **It could not open at the figures' locus.** The default display gates at one
  feature per pixel and this VCF carries every 1000 Genomes site, so 2.9 Mb of it
  draws "Too many features" and the first take filmed that banner. The tour opens
  at 20 kb and types the wide window at the END, which also puts the reason the
  matrix display exists into the clip.
- The two sections that introduced the retired figures are now one.

**2. `synteny/hg002_dotplot_import` — `tutorials/hg002_haplotypes.md`**

`Add → Dotplot view` → the import form → `Manual` → both axes → **Plot only
certain chromosomes** → wildcards → `Launch` → the palette button's `Strand`.

A route through a form that **changes shape as you use it**: a mode toggle, a
checkbox that grows two text boxes, wildcard entry, then a coloring change. The
page walks it in three paragraphs of sequential clicks.

It also fixes a live defect by construction. The audit found the page describes
the **Manual** panel and then tells the reader to switch to Manual — but the
form opens on **Quick start**, because the session holds a launchable
self-alignment track (`useQuickStartState.ts:65`, and `syntenyTrackRows.ts:14-18`
on why a self-alignment qualifies). Filming it makes that impossible to
reintroduce.

**Filmed.** `videos/synteny.ts`, 768px frame (sized to the launched plot, not the
form), 46s. Quick start confirmed at the source: `quickStartSyntenyTracks` keeps
the Q100 chain because `syntenyTrackRows` gives it two present rows, so `Manual`
is a real click — and Quick start's own launch passes an empty filter to both
axes, which is every contig of both haplotypes interleaved.

**The `:96-98` defect went the other way** and is fixed in prose rather than by
filming: the linear synteny form also opens on Quick start, where
`applyQuickStartSelections` has already put the chain's two rows in, so the
page's "pick the assembly in both rows" was describing a panel the reader never
lands on. `Launch` is the only click there.

**A second hg002 tour, off the ranking.** `synteny/hg002_follow_panels`, filmed
2026-08-23 on the same page and embedded in `user_guides/linear_synteny_view.md`
as well: 520px frame, 36s, the follow figure's own session. Follow is a MODE,
and its before-and-after still is equally true of the right-click item beside
it — the evidence that separates them is a second navigation the reader makes
and a panel below that moves on its own, which is a state no still holds. Two
things it cost: the exact pass lands about two seconds after the anchor settles,
so the 9s beats the first take gave it were reported as steps nothing happened
in; and the toggle's tooltip names the mode and the anchor row, which is worth a
beat and sits over the maternal panel's title for the whole state if the pointer
is left on the button.

**3. `sv/derivative_allele_route` — two pages at once**

`Track menu → Launch → Reconstruct derivative allele...` → pick a route →
`Draw as → Breakpoint split view` → `Replace current view`, ending on one panel
per segment.

A route **and** a re-layout. It serves `tutorials/cancer_sv.md:133-146` and
`tutorials/sv_visualization_cgiab.md:640-649`, and `sv/inspector_route` stops at
the SV inspector's table filter, so nothing overlaps.

**Filmed.** `videos/sv.ts`, 1340px frame, 34s, on COLO829's four-segment chain —
the only route that makes the page's point, since it leaves chr3 and returns to
it inverted and so draws two chr3 panels where a hand-filled form gets one. The
figure of the end state (`cancer_sv/multihop_split_view`) now reads the same
session as the tour, so their per-panel track heights cannot drift.

**The `FLOW_NUMBER` claim in the original entry is wrong.** Its three call sites
are all inside `cancer_sv/split_view_from_breakend`, which is the sibling
right-click route on a BND record (`cancer_sv.md:148-164`), not this one. Filming
this retires nothing of that machinery; retiring it needs a tour of THAT route or
a decision to drop that composite.

**4. `repeats/painting_display_switch` — `tutorials/repeatmasker_classes.md`**

`Display types → Multi-row feature display (painting)` on the RepeatMasker track.

The cheapest clip of the four and the archetypal re-layout. The page states it
with two stacked stills and a caption asserting "the same track and the same
fetch", which is exactly the claim two pictures cannot make. Hosted BED, one
menu path, no pileup.

**Filmed.** `videos/repeats.ts`, 520px frame, 35s, and it is TWO menu picks
rather than one: `Display types` leaves `partitionField` at `name`, which on
RepeatMasker is one row per repeat, so the class lanes are
`Partition by... → repClass` after it. The page never mentioned the second pick,
so a reader following it landed on the hairlines — that sentence is now on the
page, and the `Partition by...` submenu's own list of the file's columns is the
clip's payoff frame.

One thing the session had to carry: `replaceDisplay` builds the new display from
its own config rather than carrying the old one's height, so the tour's session
pins a `displays` array (packed first, multi-row second with a height) — which is
the shape this page's config section prints anyway.

`multirow/display_types_menu` stays on the page beside the clip, as does the
comparison figure.

## The rest, ranked

**The numbers are IDs, not the ranking.** `tutorial-tours-from-scratch.md`
cites these by number, so a filmed entry keeps the number it was filmed under
and a new one takes the next free number.
**Still to film, best first: 14, 18, 19**, and all three are blocked — 14 and 18
on a respine, 19 on the frame. Everything else here is filmed, and says what its
estimate got wrong.

5. **`epigenomics/bisulfite_contexts`** (`bisulfite.md`) — **FILMED**, 848px
   frame, 43s, and **headless was never in doubt**: 14 kb of Illumina WGBS over
   a plant genome is not the deep human ONT lane the swiftshader warning is
   about, and no take starved. `--headed` was not needed and nothing here says a
   pileup tour needs it; the volume is what to look at.
   It retires nothing, per the rule above — `arabidopsis_wgbs_contexts` stays,
   and the clip sits under it. What it adds is the one claim three stacked
   panels cannot make: they are the same molecules. The window is the page's
   own, the aggregate MethylDackel rows stay put as the fixed reference, and the
   lane is taller with bigger reads than the figure's copies, since a clip is
   filmed at deviceScaleFactor 1 and the figure at 2.
   **The page defect it found is in the submenu's shape.** `Show unmethylated
   (blue)` exists only while bisulfite is already the scheme in force
   (`bisulfiteMenu.ts`, `isBis`), so a reader opening `Bisulfite / EM-seq` for
   the first time sees four contexts and no checkbox — where the page listed
   both as though they arrived together. The prose says which comes first now,
   and the clip's own submenu frame is the evidence.
   Two harness findings went to `website/scripts/videos/CLAUDE.md`: Escape
   leaves one cascade level per press and stops dead at three, where
   `.MuiBackdrop-root` takes any depth in one click; and the wordmark cannot be
   that click, because a covered target falls back to `node.click()` and an SVG
   `<g>` has no such method.
6. **`sv/multisample_sort`** (`sv_multisamples.md`) — **FILMED**, 1236px frame,
   34s. The page's only figure of that track is ALREADY sorted, by clicking, in
   its own `actions` — so the order a reader lands in appears nowhere, and
   neither does the dendrogram. The right-click is anchored by locus, since
   `sortByGenotype` takes the id of the variant under the pointer and a
   right-click between records offers a menu with no sort item in it. The sort
   stays on camera (synchronous over loaded cell data); only the clustering RPC
   is cut.
7. **`hic/two_regions`** (`hic_structural_variants.md`) — **FILMED**, 1124px
   frame, 21s. Types the FIGURE's own two-region locstring rather than the one
   this entry proposed, which appears nowhere in the tree: the tour ends on the
   state `hic/bcr_abl1_translocation` is of, and opens on that string's first
   region. Two things a wide frame did to it: the Enter keypress alone filmed
   11.3s of frozen app while it re-laid out and kicked both fetches off (`cut`
   goes on the PRESS here, not on the wait after it), and the bottom matrix ran
   12px past the figure's 1100. The scan two sections down is still not filmed;
   it prints a ranking, and a page can print text.
8. **`synteny/allvsall_launch_from_selection`** (`allvsall_synteny.md`) —
   **FILMED**, 640px frame (sized to the dialog), 33s, reusing every helper
   candidate 9 added. The reorder is THREE clicks on three different buttons:
   `MoveButton` carries the panel's position in its own aria-label, so each click
   renames the control the next one is made on — which is why a still cannot show
   this dialog being used. Five rows put it over `BULK_SELECT_THRESHOLD`, so it
   also grows a Select all/none row. The clip's last frame is a different row
   order from the composite's third still, deliberately: that is what makes the
   page's "IAI39 sits directly below K-12" checkable.
9. **`synteny/restack_around_locus`** (`multiway_synteny_grape_peach_cacao.md`)
   — **FILMED**, 640px frame (sized to the dialog), 28s. The section said to
   drag "any row's scale bar", which is false in the state its own figure shows:
   a `LinearSyntenyView` keeps the synteny track on the level between two rows,
   so `launchableTracks` finds nothing on a row and no Launch submenu appears at
   all. The tour opens on the plain LGV the section's second paragraph
   describes, and the prose now says where the offer lives. The dialog's own
   "also align here … no panel" line for the four undeclared assemblies is in
   frame, which is the lane-versus-panel distinction the page makes in prose.
10. **`synteny/liftover_launch`** (`genomes_synteny.md`) — **FILMED**, 540px
    frame, 31s, on hg38 vs hs1 at _TNNT3_ rather than on the composite's
    panTro6/_FTO_ pair. **The detour was not deleted, it was MOVED**: the
    four-panel composite is now the first figure of "Trying other pairs", which
    is the section claiming the click-path works on any liftOver track and had
    no picture, and the L1HS and panTro6-hub paragraphs went with it. The clip
    lands on the window `synteny_hg38_hs1_tnnt3` is of, so the ribbon-settings
    section has a ribbon to change and the rearrangement has something to read.
    Two things the entry did not know: the dialog is NOT the frame's constraint
    here (two checkboxes and a number field, against the region launch's panel
    list), and the block under the cursor is the whole-chromosome hg38→hs1
    chain — so unticking the CIGAR box opens both panels on all of chr11, which
    is now the sentence after the checkbox is named. Hovered rather than
    toggled: unticking it films a launch nobody wants.
11. **`synteny/dotplot_reorder`** (`mcscan_synteny_grape_peach.md`) —
    **FILMED**, 768px frame, 28s rather than the five seconds this entry
    estimated: it is a menu item that opens a dialog and does nothing until a
    second click, and the dialog counts what it moved and what it reversed.
    Needed one source change — the dotplot header's ⋮ button had neither a
    label nor a testid, so it has `dotplot_view_menu` now. The figure's session
    could not be reused: it carries `autoDiagonalize`, which runs as the view
    opens, before a camera would be on.
12. **`epigenomics/chromhmm_cluster`** (`chromhmm.md`) — **FILMED**, 890px
    frame, 21s. The figure's session sets `runClustering: true`, an init flag the
    autorun fires as the display first reports ready, so it could not be the
    tour's session — same shape as the dotplot's `autoDiagonalize`. Unclustered
    is not unordered here: `config_demo.json` pins a 127-line `rowOrder` in
    Roadmap tissue order, so the opening frame is a clean tissue stripe over a
    painting with no block in it and the run trades one for the other. On camera
    throughout: the run names its own phases over a determinate bar, which is
    the page's evidence rather than a spinner.
13. **`pangenome/tier_to_fine`** (`pangenome_ecoli.md`) — **FILMED**, 810px
    frame, 17s, headless (the graph-fetch risk this entry and the handoff both
    flagged never appeared: the tour navigates a view rather than cutting a
    subgraph, so nothing in it goes near the FMMM engine). What the estimate got
    wrong, and what the next tour on this page starts from:

    - **The move is the NODE'S OWN MENU, not the location box.** A tier node
      carries the K12 span it stands for, and the plugin's `showInLinearView`
      navigates the CONNECTED linear view rather than adding one — with a single
      K12 view in the session it pairs with it by assembly — so
      `Open in K12 — around this node` lands the view on the bubble and the
      reader never types a coordinate. That is also what keeps this from being a
      second filming of `pggb_subgraph_launch`: no paste, no typed locus, no
      launch.
    - **Don't end it on the fine graph.** Launching the fine subgraph from the
      landed window was tried and measured: it puts a third view under the other
      two (1,430px of app against 722px without it) and its drawing is the frame
      `pggb_subgraph_launch` already ends on. The clip stops in the linear view.
    - **The opening frame is the density gate on purpose**, which is the one
      place that banner is the state the page describes: the section is titled
      "when the window is wider than the graph can draw", and the banner going
      away is what the last step waits on. A gated display reports its ready
      phase while it is refusing to fetch, so `waitForText hidden` on the banner
      is the wait, not `displayReady`.
    - **`Highlight in K12` was tried and dropped.** It marks the bubble in the
      100 kb window nicely and then the window becomes the highlight, so the
      landed frame is washed orange edge to edge. The hover does the same job
      for free: hovering a node syncs a band into the linear view above.
    - The page defect it turned up is in the paragraph after the tier figure —
      **Bubble spread → Compress lengths** is a force-layout instrument (the
      plugin's own caption says so) and the tier figure is anchored, while the
      "one arm is 1,199 bp against neighbours of one to seventy" it cites is the
      FINE cut's numbers. Moved up under `pggb_subgraph_launch`, whose clip ends
      on exactly that drawing.
14. **`rnaseq/group_by_strand`** (`rnaseq.md`) — `Group by... → First-of-pair
    strand` on the MHC class III window. **Do the page's restructuring first**
    (`tutorial-structure-audit.md`): filming a page whose sections are
    reorderable just films the confusion. Note the audit also found the current
    instruction contradicts the figure it introduces.
15. **`config/settings_to_json`** (`display_settings.md`) — **FILMED**, 860px
    frame (sized to the menu and the dialog, not the app), 46s, the longest clip
    in the corpus. Three settings off ONE open track menu, then `Share` → the
    dialog's settings icon → `Plaintext JSON` → `Show readable JSON`. The second
    half is a dialog that CHANGES SHAPE twice: the mode is a radio inside a
    `CascadingMenuButton` rather than a control on the dialog's face, picking it
    refires the fetch, and only then does a checkbox exist to tick, and only
    then a panel to read. The page said "click Share, choose Plaintext JSON, and
    tick Show readable JSON", which reads as three controls on one face, two of
    which are not there when it opens.

    **It found three defects in the page, the most any tour has.** `Color by...`
    has a `Paired end` level the page did not spell, so a reader following it
    landed on six basic schemes with no such row in them (the first take died on
    the `waitForText`). The fence under "Ask JBrowse what you just set" printed
    the settings inside the view's `displays` array, and the app does not put
    them there — all three are `setConf` writes and land in the session's
    `trackConfigDeltas`, which is what the dialog prints. And the bullets were in
    an order that made one of them a no-op: `setLinkedReads` nudges a `colorBy`
    still at `normal` to `insertSizeAndOrientation` on the way into chain mode,
    so taking pairs first left the colour pick already made. Colour goes first
    now, on the page and in the clip.

    **What it does not do is scroll the readable-JSON panel to the keys**, and
    that was the last thing decided. Twenty rows, an ~80-line session, and the
    only lever is a caret: PageDown from wherever the click landed moved fifteen
    lines between two takes, and PageDown to the end is deterministic and stops
    one screen past them. Reading text off a moving film lost to the fence
    beside it — the clip carries the route and the page carries the keys, which
    is the division this corpus is built on.

    Two estimates corrected for whoever is next. The pileup objection that
    ranked this last of ten in `tutorial-tours-from-scratch.md` was wrong:
    `volvox-sv.cram` is 42 KB of local `test_data` over 10 kb, and a pileup is a
    size question rather than a kind. And the run's `PAGE BACKGROUND UNDER THE
    APP` is a false positive here — the app is 456px, and the two things the
    frame is actually for, a ten-row `Show...` submenu and the dialog with its
    panel open, reach 808 and 717.
16. **`genomes_basics/gnomad_filter`** (`genomes_basics.md`) — **FILMED**, 640px
    frame (sized to the dialog), 25s. `Track menu → Filter by...` on gnomAD v4.1
    Exomes, the empty **Add track filters** dialog, one jexl line typed into it,
    Submit, and the lane redrawn. What the estimate got wrong:

    - **The renamed row is not the payoff and was cut from the clip.** This
      entry sold it as "the only control in the corpus renamed by the click
      before it", and Colin's call is that a live number does not belong in a
      control's label — so a clip climaxing on a menu row growing a `(1)` argues
      for something he does not want. It stays in the app (it counts active
      filters, which is hidden state nothing else on screen reveals, and it
      gates `Clear all filters`), and what the page was missing is named in
      prose instead: **Edit filters...** and **Clear all filters** inside the
      submenu, which the page never mentioned at all.
    - **Filming the beat anyway broke the clip, and that is the harness
      finding.** Reopening the menu at the end put the whole cascade in the last
      quarter of the run; `recorder.stop()` timed out at 15s, ~12s of on-camera
      time never reached the file, and the poster was a cascade standing over
      the payoff. The `stop()` timeout line is not one of the four the run
      reports on. **The clip's last STATE CHANGE has to be the payoff**, not
      just its last hold.
    - **The redraw does more than empty the lane: it labels it.** Cutting to the
      pLoF set drops the window under `maxLabelFeatureDensity`, so the same lane
      comes back with a name on every record. That is the frame, and it is a
      better one than the entry predicted.
    - The frame is the DIALOG's (~490px centred) and the fixture pins a taller
      lane than the figure's 200 so the closing frame is not a third page
      background. hgdownload was never the problem: the ready gate is
      `displayReady` on the track's declared `displayId` and it cleared in ~4s
      both takes.
    - Gap 8 is unchanged — nothing pairs the typed jexl with the page's copy of
      it. Both come off `GNOMAD_PLOF_FILTER` in `specs/genomes_basics.ts`, which
      the figure beside the clip also reads, so the two texts are one text by
      construction rather than by a check.
17. **`genomes_basics/find_a_track`** (`genomes_basics.md`) — **FILMED**, 520px
    frame, 30s, and it was the cheapest thing on the page as promised: no new
    helpers, no source change, green on the first take. Open track selector →
    `phyloP` into **Filter tracks** → tick **Basewise Conservation (phyloP) -
    100-way vertebrate alignment** → the lane draws over TP53 → close the
    drawer. What the estimate got wrong:

    - **It is a round TRIP, and the return leg is what lands the payoff frame.**
      The drawer takes 384px off the view, and an LGV holds its window in BP
      across a resize, so the drawer is a zoom and closing it draws the same
      span back at full width — which makes the last frame `phylop_tp53`'s own
      state and lets the clip end where the next section starts. Two toggles,
      two titles: the button says `Open track selector` and then `Close track
      selector`.
    - **The filter frame is the one worth having, and it is not the checkbox.**
      `phyloP` leaves one category and seven rows, six of them phyloP tracks
      whose names differ only after the parenthesis — which is why the page
      spells the name out in full and could not say so before. That sentence is
      on the page now.
    - **The page's own instruction was wrong and is fixed.** "Open the track
      selector at the top left" describes opening something a reader already
      has: the hosted config's `defaultSession` activates the
      `hierarchicalTrackSelector` widget, and the page says so itself two
      sections up. It now names the drawer, says a genome opens with it showing,
      and names the button that closes and reopens it.
    - **A session spec cannot open a drawer** — the spec shape carries `views`,
      `sessionTracks`, `sessionAssemblies` and `sessionConnections`, and no
      widgets — so a tour whose subject is a drawer opens it by clicking, which
      is what a reader does anyway.
    - The frame is the END state's (445px app) plus the caption chip's strip.
      The opening app is 306px and the drawer fills the rest from the second
      step on; the run reports drawer height separately and does not read the
      difference as slack.
    - Still true: do NOT fold the search route in beside it. Pressing Enter on
      `TP53` opens the name index's own gene track as well, which the page never
      mentions and a still declared its way past.
18. **`orthofinder_synteny/same_scale`** (`orthofinder_synteny.md`) — the view
    menu's **Show all regions - each row fit to width** → **Show all regions -
    same bp per pixel**, one radio, six rows visibly re-scaling from
    equal-length to genome-length, which is what `:82-85` describes and no
    figure holds. `keepMenuOpen: false` on both rows, so it is the one radio
    tour that needs no Escape-and-blur. **Blocked twice**: the target is the
    heaviest figure in `specs/synteny.ts` by its own comment (269,656 gene
    links, a 300s ready gate, the sole synteny failure on the first CI sweeps),
    and `tutorial-structure-audit.md:32-37` condemns the page as three datasets
    with the dependency arrow running backwards through half of it. Re-rank it
    after the respine and after the re-render `TODO.md` has queued for those
    figures.
19. **`local_ancestry/cluster_painting`** (`local_ancestry.md`) — `Clustering →
    Cluster rows by similarity` on the ancestry painting. The prose at
    `:304-306` is genuinely orphaned: `dog10k-wolfdog-ancestry-clustered` was
    deleted, so what that figure knew is a paragraph with no picture. **It does
    not fit the frame.** The claim is about the 243-animal painting, whose 486
    rows were a 2,610px capture, against a 1920-wide encode ceiling and a 960
    default height; filming the 64-row named track instead films rows already in
    descending wolf-fraction order, where the reorder barely moves and "with no
    access to the breed names" mostly evaporates. Revisit if a per-clade cut of
    that BED is ever hosted.

## Pages that should not get a tour

From a re-survey of every untoured page on 2026-08-21. This half is worth as
much as the ranking: each of these looks like a candidate from the index and
stops being one on the page.

**No route on the page at all.** A pipeline page whose payoff is a static
comparison is a still's job by construction, and a tour of it would retire no
prose.

- **`dtu.md`** — the only sentence containing "click" is an aside about where an
  isoform's numbers live. Six sections of shell and one JSON fence.
- **`homoeolog_synteny.md`** — no click, menu, dialog or re-layout anywhere. Its
  one control (`dN/dS`) is named as the destination of a config value. The
  dotplot also opens in ~300s.
- **`selection_pressure.md`** — structurally the best-formed tutorial of the set
  and therefore the emptiest: one palette radio and one ribbon click, both
  within ten lines of the page's only figure, which already shows the first
  one's result. **Prose to fix instead**: `:141` spells `Color by... → dN/dS`,
  and on a `LinearSyntenyView` that mode is a flat radio on the header's palette
  button with no `Color by...` parent.
- **`ld_mosquitoes.md`** — every state it names is a config slot (`groupBy`,
  `colorBy`, `referenceDrawingMode`, `ldMetric`, `minorAlleleFrequencyFilter`),
  and the one menu that could carry a tour is never written as a menu path. Its
  figure's own frame is 1385px, past the 960 default. Sections freely
  reorderable.
- **`sv_callset_review.md`** — a CLI page that says so at `:96-97` ("no browser
  is involved"). **The fix was an embed, not a shoot**: its one app section
  hands off to routes already filmed on the same COLO829 der(3) junction its
  figure is of, so it took `sv/derivative_allele_route`, which now serves three
  pages. Done; it is no longer an untoured page, and the clip it embeds is the
  reason it never needs its own.

**The route is real and already filmed somewhere else.** A second clip of one
cascade teaches a reader nothing new about the app.

- **`dog10k_lof.md`** — one clause naming `Clustering → Cluster rows by
  similarity`, which is `dog10k/igf1_cluster_route` on the sibling page, here
  over 1,987 rows instead of 167 and behind a 180s RPC.
- **`ld_human.md`** — same menu, same display type, same dialog as
  `dog10k/igf1_cluster_route`, at the corpus's slowest open (that page's figures
  need 600s and 300s ready gates) and a 1238px frame it cannot shed without
  dropping the LD triangle the page is about.
- **`population_cnv.md`** — `Clustering → Cluster rows by score...` would be the
  SIXTH clip of that cascade, after tcga_cohort_cnv, dog10k_selection, chromhmm,
  pangenome_hprc, sv_multisamples and the clustering user guide. **Do the still
  instead**: both heatmap figures set `runClustering: true`, so "rows are in
  file order until you do" is pictured nowhere, and an unclustered twin costs
  one spec and is diffable.
- **`scatac_pseudobulk.md`** — the multi-wiggle add-track form is the best
  MECHANISM the survey found (a grid that does not exist until **Add tracks** is
  pressed, an editable Name column, a Submit that unlocks on three conditions),
  and it is on the wrong page: the section is one of three the page declares
  interchangeable, its home is `user_guides/multiquantitative_track.md`, and
  `ui/bulk_add_tracks` is its near twin. **It belongs on the user-guide list.**

**The harness cannot reach it.**

- **`cli_desktop.md`** and `quickstart_desktop.md` — desktop cannot be filmed at
  all; the handoff carries why, so nobody re-derives it.
- **`embed_linear_genome_view.md`** — no route (four code fences and a
  `<details>`), and no way to film one if there were: `VideoSpec` carries only a
  `url` and the generator serves the jbrowse-web build. Gap 9.
- **`scrna_pseudobulk.md`** — delegates its one UI workflow to
  `scatac_pseudobulk` in its own words, and the only thing on it that MOVES (the
  UMAP filtering the rows, a gene selection recolouring the cells) lives in the
  react-LGV examples site. Also under an open merge question with its sibling.

**The page has to be restructured first.** Filming a page whose sections are
reorderable just films the confusion.

- **`dog10k_svs.md`** — two single-step interactions on 618 lines, each already
  in a figure within fifty lines of it, and `tutorial-structure-audit.md:45-50`
  names the page as the reorderable case in its own TL;DR's words.
- **`mappability_qc.md`** — it HAS the shape: three numbered steps at `:168-179`
  with no figure near them, and a `Score → Summary score mode` flip whose losing
  half is in no picture. Both sit on a 30x remote CRAM that needs `forceLoad` to
  draw at all and whose still costs a 600s ready gate. Revisit with `--headed`
  if that pileup is ever cheap enough.
- **`population_genomics.md`** — the lightest here to film and the least worth
  it. Its one re-layout names **Show all regions in assembly**, which is not
  what the figure's session does (`popgen/fst_in2lt_2L` pins six
  `displayedRegionNames` against a dm6 hub carrying every scaffold), so a tour
  would film a picture the page does not contain. **Two prose fixes instead**:
  say what `:267` is actually of, and note that the `groupBy` re-sort at
  `:322-324` has no UI at all, since `setGroupBy` has no call site outside
  tests.

## Traps, in the order they bit

All of them cost a take or a debug cycle on 2026-08-21.

- **Rebuild `@jbrowse/web` before any run.** The generator serves the BUILD's
  assets, so a component edit made after the build is invisible and the failure
  is a missing selector.
- **`clear: true` used to select one LINE**, so a multiline field kept every
  other line and took the new value into the middle of them. Fixed in
  `website/scripts/actions.ts`, which calls `select()` now. The tell was a clip
  that filmed a disabled button being clicked and reported success.
- **Size a dialog-centred tour to the DIALOG.** The run's content report
  measures app height only, so it will tell you to shrink a frame the dialog
  needs. Pull a mid-clip frame with `ffmpeg -ss` and look.
- **The clip's last STATE CHANGE has to be the payoff.** A `recorder.stop()`
  timeout drops whatever ffmpeg had not flushed — twelve seconds of it on
  `gnomad_filter`'s first take — and the run logs that on a line none of the
  four report sections covers. Pull the POSTER and look at it, every time.
- **`cut: true` on a `type` step** is how a paste is filmed. Five URLs typed a
  keystroke at a time read as 9.4s of nothing happening.
- **A re-frame needs `pnpm autogen`**, or the page reserves a box the wrong
  shape. Two generators always refuse in a worktree (jbrowse-img, social card);
  that is main's staleness, not yours.
- **`pnpm figures:push --filter <name>`**, never bare, then commit `media.lock`.
  A figure store with nothing on disk is skipped rather than emptied, which is
  what makes a media-only push safe from a worktree that never pulled figures.
- **Don't film a reader reading.** A tour that ends by scrolling a text panel to
  the line that matters is filming the one thing a page does better: the fence
  beside the clip is searchable, diffable and holds still.
  `config/settings_to_json` spent three takes trying to land a 20-row JSON panel
  on four keys before dropping the scroll entirely, and the clip got shorter and
  clearer for it. A clip carries the route; the page carries the text the route
  produced.
- **A menu path a page prints is a claim, and a `waitForText` is what checks
  it.** Two of the four page defects this thread has found were levels missing
  from a cascade, and both showed up as a step dying by name rather than as
  anything anyone read. Write the path the page prints, not the path you
  verified in the source, and let the run disagree.
- **Check whether the app already did the next step for you.** An action that
  writes one setting can nudge another (`setLinkedReads` sets `colorBy` on the
  way into chain mode), so a tour taking a page's bullets in order can film a
  click that changes nothing and report success. The frame to pull is the menu
  BEFORE the click: a radio already filled in is the tell.

## What is still missing from the harness

In `tutorial-tours-from-scratch.md`, which is where the numbered gaps live. The
three that reach this list: **a typed URL is paired with no page**, so a rehost
moves the film and the prose apart silently (six proposals type one),
**`scrollTo` cannot scroll a drawer**, which caps how tall a drawer-subject tour
can be, and **nothing can position a scrollable field inside a dialog** (gap
10), which is what took the scroll out of `config/settings_to_json`.
