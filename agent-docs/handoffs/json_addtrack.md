---
name: json-addtrack
description: Bugs in the spec-recipe add-track dialog output: literal markdown in notes, launch-dialog settings emitted after "Click Launch", and related recipe issues.
---

Bugs

1. Markdown shows up as literal text in dialog notes. renderStep (spec-recipe/html.ts) runs step titles through renderTitle but only escapes notes and examples. So **Quick start** shows its asterisks (68 places in the built site) and This figure filters on `feature.type!='pseudogene'`  shows its backticks (33). The source strings are recipe.ts:329 and fields.ts:817.
2. A launch-dialog setting comes after "Click Launch." collapseEmptyRows is a view field, so it's emitted after importFormSteps has already said to click Launch. In odp_linkage_groups_synteny it's the last step, seven steps after Launch. It also never changes anything: all 18 occurrences say "(checked)", and the step's own note says that's the default.
3. The dialog's tab row jumps when you switch tabs. The dialog centers on its content height, so the short "In Desktop" panel moves the tab row down 212px on desktop and 119px on a phone. The next tab you meant to click is no longer under the cursor. Pinning the dialog's top (or fixing its height) in spec-recipe.css fixes it.
4. The Desktop tab on SyntenyTrack fences sends readers to the wrong view (35 fences). It says to open a view on the track's assembly, then File → Open track… → Add track from pasted JSON. Going by doPasteConfigSubmit, that shows the track inside the linear view, not in the synteny view the tutorial is about. I read that from the code and didn't drive it in the app. The recipe side already words the right route (IMPORT_FORM_VIEWS: Add → Linear synteny view → Quick start), and desktopTrackNodes could branch on it.

Bigger improvements

5. Nearly half the figure tracks can't be identified. 249 of the 536 track references in tutorial figures can't be looked up, because configs.ts reads only test_data/. The reader gets a bare id like “ecoli_pggb_ava” and no hint of what file type they need. For 85 of those, an addtrack fence on the same page already has thefixes:
   - Use the page's own fences: feed them into lookupTrack. This could also link the step to the
     fence ("configured above").
   - Snapshot the hosted configs: commit a generated snapshot of their track lists, like
     liveLinks.generated.ts. That w a network fetch during the build.
6. Remember which tab the reader picked. Tutorial pages have up to 12 fences, and a Desktop user has
   to click "JBrowse Desktop" on evlocalStorage could check thesame-labelled radio in every group on the page, and the tabs would still work without JS.
7. The "Do it yourself" steps are fk's settings are separate numberedsteps, with the track's name on a trailing line like “Severus somatic SVs (HiFi)”. Nesting them
   under that track's "Add your ownr. "Drag the bar… to resize it"alone appears 585 times across the 431 dialogs. Steps that set a value to its default (like #2)
   could be dropped.
8. The Config file tab is the only tab with no instruction. The Desktop and CLI tabs each say how to
   apply the config. The Config filCLAUDE.md tells authors not towrite "add this to the tracks array" in the prose. A reader new to config.json gets no pointer at
   all. One line inside that tab wo
9. Fences could get a live link. 121 of the 207 fences use only absolute URIs, so they could get an
   "Open in JBrowse" tab, and the slink through toProtocolUrl. It would be opt-in with a config= in the fence meta, the way session fences already work.

Smaller polish

- Six tabs wrap onto two rows on desktop and three on a phone. Shorter labels (Steps / Desktop / CLI
  / Spec / Notebook / Agent) would
- The Session spec tab overstates where it works. It says the spec "pastes after &session=spec- on
  any JBrowse Web instance", but itly works against the config itnames. That caveat sits below a 45vh scroll box, so it could move above the JSON.
- The Desktop paste URL is cut off.ideways, and the Copy button sits on top of it. Wrapping it would fix both.

Items 1–4 are small, self-contained fixes. Items 5 and 6 would do the most for readers. Want me to take 1–4 in a worktree, or start wi
