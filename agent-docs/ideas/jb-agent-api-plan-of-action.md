---
name: jb-agent-api-plan-of-action
description: Plan of action from the five filmed MCP takes (2026-09-01) for the `jb` helper library, the desktop MCP server and the agent docs — ranked by the run_javascript calls each gap cost in the transcripts, after an independent review struck the items the tree had already fixed and the helpers that duplicated `sessionSummary`. Most of what remains is docs and recipes; the one model change is making `applyLayoutSpec` visible without a separate `setUseWorkspaces`.
---

# `jb` and the desktop MCP server: plan of action from the filmed takes

Source of truth is the five transcripts under `scripts/agent-demos/`
(`takes/*-take1-transcript.txt`, `take5-transcript.txt`,
`web-take1-transcript.txt`), all filmed 2026-09-01, and the notes beside them.
A first draft of this plan was reviewed independently on 2026-09-06 against
those transcripts and the code; the review struck five of its items, and this
is the merged version. Two lessons from that review are worth keeping in front
of the next reader:

- **Every take predates a day of fixes.** Commits on 2026-09-02 fixed the
  layout key, the `listTracks` shape sentence, `offscreen`'s numbers and the
  `moveViewToSplitRight` default, so a transcript incident is not a live bug
  until checked against main.
- **A helper that restates `sessionSummary` fails the roster rule**
  (`jbApi.test.ts`, "the jb roster"). "The raw model is verbose" does not
  admit a member.

## Already fixed on main, do not re-propose

- A layout leaf spelled `viewIds` throws naming the key
  (`packages/app-core/src/WorkspaceLayout/spec.ts`). This, not call order,
  is what collapsed the protein take's workspace into one tab.
- `moveViewToSplitRight(viewId)` / `moveViewToNewTab(viewId)` default their
  view list to the session's.
- `session.takeOutViewsMissingFrom` throws pointing at `removeView`.
- `jb.listTracks` answers `{ total, tracks }` and the live-model guide says
  so (`6f2f950f4e`); the web take's `.slice` crash predates it.
- `jb.getFeatures(trackId, loc?)` positional form exists; the protein take's
  one-string call predates it.
- `jb.waitReady`'s `offscreen` carries `pageHeight`, `windowHeight` and each
  offscreen view's `top`/`bottom` (`beadd8d8f2`). Only `scrollY` is missing.
- `jb.getFeatures` refuses a region over the byte gate rather than answering
  short; `run_javascript` truncates past `maxBytes`.

## Do, in this order

### Docs and recipes, no roster growth

**"Dropped SILENTLY" is false in three places.** `SERVER_INSTRUCTIONS` and the
`run_javascript` description in `toolDefinitions.ts`, `JB_HELP` in `jbApi.ts`,
and `.claude/skills/jbrowse-mcp/SKILL.md` all say an unknown settings key is
dropped silently. `applyDisplaySettings.test.ts` proves it lands in the
report's `unapplied` list, and the same tool-description paragraph says so two
sentences later. Rewrite the sentence in all three: an unknown key lands in
`unapplied`; read the report.

**Three recipes the transcripts asked for and `agents_recipes.md` lacks.**

- *Side by side.* Two takes asked for it; no recipe covers a layout. Shows the
  three-call order (below) or the helper once it exists.
- *Check a remote file's genome build before adding it.* Take 5 spent seven
  calls learning `jb.getFeatureAdapterOrThrow` is async, returns
  `{ dataAdapter }`, and how to call `getHeader`; the web take's `jb.require`
  attempt died the same way. This cost more turns than any layout item outside
  the protein take.
- *Show the same track under another display type.* The derivative take spent
  seven calls building a `LinearReadArcsDisplay` over the same CRAM through
  `replaceDisplay` and re-adds. `view.showTrack(id, {}, { type })` already does
  it.

**Two guide additions.** Add `scrollY` to `offscreen` (one line in
`offscreenViews`) and say in the guide that a view can be in frame by the
model and scrolled out of it by the page. Add the probe the protein agent
invented for an undocumented model element: call the action with `{}` to
materialize MST defaults, `jb.inspect` the created node, then remove it.

**Saving a session.** The synteny take hunted `rootModel` for a save action
for three calls and then hand-wrote a spec in the shell. Name the existing
path in the guide (whatever the desktop session-save action is), or state that
there is none from `jb` and the spec the agent loaded is the record.

### `applyLayoutSpec` becomes visible without a separate `setUseWorkspaces`

**Gap.** The live-model guide says `applyLayoutSpec` does not turn workspaces
on and without it the tree is rebuilt and nothing visible changes. That is a
silent-wrong the tree documents rather than fixes. Separately, `orderViews`
on the return value is what makes a tab's stated order take effect
(`loadSessionSpec.ts` explains at its call site) and it appears in no
agent-facing text.

**Constraint.** `applyLayoutSpec` lives in `WorkspaceLayoutMixin`;
`setUseWorkspaces` and `orderViews` in `MultipleViewsSessionMixin`. A mixin
casting to reach its host fails the build (`HostChecksSlotNames`).

**Change.** Lift the three-call sequence `loadSessionSpec.ts` already runs
behind `isSessionWithWorkspaceLayout` into one exported app-core function,
`applySessionLayout(session, spec)`, and have both `loadSessionSpec` and a
`jb.layout(spec)` member call it. One implementation, no new model surface,
the duck-typed guard already exists. It throws when the resolved spec seats
zero views. If a session-level composed action is preferred, it belongs in
product-core where both mixins are already composed.

**Test.** `jbApi.test.ts`: two views, `jb.layout` with a horizontal container,
assert `effectiveUseWorkspaces`, two panels, `session.views` in spec order.

### `jb.getFeatures(trackId, loc?, opts?)`

The synteny take wrote exactly this with `{ assembly }` third and the argument
was ignored. Accept it rather than throw: the object form's `assembly`,
`viewId` and `byteLimit` are the options. Update the three prose copies.

### Plugin actions the agents named

- `LinearComparativeView.resizeAllLevelHeights(distance)` is a delta and
  reads as absolute. Add `setAllLevelHeights(px)` over the existing
  `level.setHeight`; keep the old name.
- `DotplotView` documents a per-axis `loc` launch key that nothing consumes.
  Implement it or drop the doc line.
- `DotplotView.setHeight` leaves both axes at the old scale, so one crops.
  The LGV also keeps bp-per-px across a resize, so this is a UX question; the
  cheap fix is a guide line: call `showAllRegions()` after `setHeight`.

### Readiness and the ProteinView docs thread

**Readiness.** The protein take hand-rolled a dozen `setTimeout` sleeps and
never called `jb.waitReady` or read `live-model`, so the transcript does not
prove ProteinView fails the readiness protocol. What is true: `AppReadyMarker`
reads `showLoading` and `initialized` on a view, and `showLoading` is the one
hook an out-of-tree view has. Document that contract for plugin authors and
have `jbrowse-plugin-protein3d` set it while Molstar loads. Not `bodyMounted`,
which is the container's intersection flag.

**ProteinView docs.** `takes/protein.md` "State on 2026-09-02" records the
half-wired external-plugin doc generation: `pnpm gendocs` fails on an in-tree
hygiene assertion at `generateConfigDocs.ts:1446`, and the plugin's tag is
`Protein3dViewPlugin`, so `docs topic:"model:ProteinView"` misses until
`lookupTypeDoc` learns the composed MST name. Finish it. That section is a
handoff living in a take note, which `agent-docs/CLAUDE.md` forbids; move it
to `handoffs/` or close it in the same pass.

**`SERVER_INSTRUCTIONS` is not landing.** The protein agent skipped
`live-model` despite the instruction to read it first, and read `session-spec`
three times instead. Worth knowing before adding more to the instructions
string; the skill's first line is the other delivery channel.

## Struck by the review

- **`jb.fitToWindow`.** Needs per-view-type height knowledge (the LGV has no
  `setHeight`; synteny resizes levels; dotplot sets height), overwrites heights
  the user set, and the real gap was knowing the view was offscreen, which
  `offscreen` now answers.
- **`jb.views()` / `jb.view(index)`.** `sessionSummary().views` is already
  that list, with ids. `session.views[i]` never cost a turn.
- **`jb.setTrackFeatures`.** Swapping the slot under the same `adapterId`
  leaves the worker adapter cache stale too; the recipe already mints a fresh
  id for that reason. The "features cover less than the visible region" heuristic
  for `notReady` is wrong: take 5's own audit found RefSeq at 54% coverage and
  called it correct. Keep only the recipe sentence: for anything you will pan,
  write a bedGraph or bigWig with `window.require('fs')` and `jb.addTrack` it,
  so an artifact exists on disk.
- **Picking up `one-generated-description-of-the-jb-surface` now.** Its trigger
  is a second signature drift, and "SILENTLY" is prose, not a signature.
- **`jb.job`.** Every `globalThis` use in the transcripts carried a value across
  the serialization boundary; none was a long job. Leave it where
  `mcp-2026-07-28-adoption-points.md` has it.
- **Security changes to the bridge.** The socket directory is 0700 and
  ownership-checked (`socketPath.ts`); `webSecurity: false` is on record as
  load-bearing for CORS (`reference/DESKTOP_CONTEXT_ISOLATION.md`);
  `--no-sandbox` is the recording harness only.

## Definition of done per item

Typecheck `app-core` and `jbrowse-desktop`, `pnpm test-related`, `pnpm lint
--fix`. Because the prose copies move: `docsRoster.test.ts` green and `pnpm
autogen --check`. A `jb` member added without all three copies updated is the
drift the "SILENTLY" item shows.
