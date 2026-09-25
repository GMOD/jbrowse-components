---
name: json-addtrack
description: Improvements to the figure-recipe dialog and the addtrack fences' tabs, after the four bugs were fixed. Unresolved figure track ids and remembering the reader's tab would do the most for readers; none is started.
---

The four bugs (literal markdown in notes, a launch-dialog step after "Click
Launch", the tab row jumping, the Desktop tab on synteny fences stopping at the
linear view) are fixed on main.

Bigger improvements

1. Nearly half the figure tracks can't be identified. 249 of the 536 track references in tutorial figures can't be looked up, because configs.ts reads only test_data/. The reader gets a bare id like “ecoli_pggb_ava” and no hint of what file type they need. For 85 of those, an addtrack fence on the same page already has thefixes:
   - Use the page's own fences: feed them into lookupTrack. This could also link the step to the
     fence ("configured above").
   - Snapshot the hosted configs: commit a generated snapshot of their track lists, like
     liveLinks.generated.ts. That w a network fetch during the build.
2. Remember which tab the reader picked. Tutorial pages have up to 12 fences, and a Desktop user has
   to click "JBrowse Desktop" on evlocalStorage could check thesame-labelled radio in every group on the page, and the tabs would still work without JS.
3. The "Do it yourself" steps are fk's settings are separate numberedsteps, with the track's name on a trailing line like “Severus somatic SVs (HiFi)”. Nesting them
   under that track's "Add your ownr. "Drag the bar… to resize it"alone appears 585 times across the 431 dialogs. Steps that set a value to its default could be dropped,
   the way `launchFields` in spec-recipe/fields.ts drops collapseEmptyRows.
4. The Config file tab is the only tab with no instruction. The Desktop and CLI tabs each say how to
   apply the config. The Config filCLAUDE.md tells authors not towrite "add this to the tracks array" in the prose. A reader new to config.json gets no pointer at
   all. One line inside that tab wo
5. Fences could get a live link. 121 of the 207 fences use only absolute URIs, so they could get an
   "Open in JBrowse" tab, and the slink through toProtocolUrl. It would be opt-in with a config= in the fence meta, the way session fences already work.

Smaller polish

- Six tabs wrap onto two rows on desktop and three on a phone. Shorter labels (Steps / Desktop / CLI
  / Spec / Notebook / Agent) would
- The Session spec tab overstates where it works. It says the spec "pastes after &session=spec- on
  any JBrowse Web instance", but itly works against the config itnames. That caveat sits below a 45vh scroll box, so it could move above the JSON.
- The Desktop paste URL is cut off.ideways, and the Copy button sits on top of it. Wrapping it would fix both.
