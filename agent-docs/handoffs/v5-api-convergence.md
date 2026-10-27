---
name: v5-api-convergence
description: "How the v5 API surface settles: no freeze date, a conformance suite and a weekly settling meter instead, beta-only compat shims deleted, v4.3.0 configs loading where a mapping exists, and `LinearMarkDisplay` allowed to keep evolving. Read before respelling a setting, amending ADR-238, or cutting a release candidate."
---

# v5 API convergence

- **In:** the config slots, session spec, jbrowse-img and `jb` arguments, and
  plugin ABI that v5 ships.
- **Out:** a surface that stops changing once the work is done.

Claim a step here before starting it.

## Rules

- **No freeze date.** Churn continues while a rename still improves the
  surface. The release candidate waits for the settling meter (step 1).
- **A respell is a complete sweep.** One change updates every display, the
  docs, the figure specs and each writer (step 5). A partial respell leaves the
  next session a divergence to fix.
- **Beta share links and display state may break.** No migration exists for
  them.
- **v4.3.0 configs load where a mapping exists.** An edge-case slot may drop
  with a warning naming it.
- **Built-in display types converge as far as they can.** The shared
  vocabulary (`encoding`, `scale`, `legend`, `axis`, `filter`, parts with
  `show`) is the surface that settles.
- **`LinearMarkDisplay` may keep evolving.** Its own words (`marks`, the
  transform steps, facet bands) change additively, and a mark-display change
  never respells a shared-vocabulary slot.
- **Review rounds test conformance.** A taste item goes to `ideas/`.

## Baseline, 2026-10-26

Two independent agent reviews measured this. A slot moving into a sub-schema
counts as a remove and an add, so slot-path counts are good to about ±30%.

- Config slot paths: +506 / −386 between Oct 15 and Oct 26, against +99 / −71
  in Oct 1–15.
- `retired` maps: 0 files on Sep 1, 36 files (about 102 entries) on Oct 26,
  many holding beta-only spellings.
- ADR-238 took four dated amendments in six days.
- Stable already: CLI commands and flags, session-spec format, registered type
  names, the MCP tool set.

## Next

1. **Settling meter.** Build it on `slotPaths` in `scripts/configSlotPaths.ts`.
   Each week it diffs the schema's slot paths against the previous snapshot and
   logs paths added and removed, ADR amendments to locked ADRs, and
   conformance failures. Mark-display-only paths count separately.
   `scripts/check-config-slot-paths.ts` is no substitute: it compares against a
   baseline that `scripts/release.ts` writes on a stable release, so it checks
   nothing before 5.0.0. The release candidate comes after the meter reads near
   zero for 14 days.
2. **Delete the beta-only shims.** Remove each `retired*`/`lift*` map whose
   names never shipped in v4.3.0. Keep those that map a v4.3.0 spelling.
3. **Conformance suite.** Grow `colorConformance.test.ts` and ADR-238 into
   checks that find divergence without review:
   - Empty its `EXCEPTIONS`, or document each entry as intended on the config
     page.
   - Refuse a new `show*`, `hide*`, `min*` or `max*` slot outside an allowlist
     that gives a reason.
4. **Rule the leftovers once.** Decide each item in
   `ideas/waiting-on-a-call/vega-lite-layout-and-multiway-leftovers.md`, then
   fold the rulings into ADR-238 in one pass:
   - pixel words (`spacingPx`, `paddingPx`, `minimumRadiusPx`,
     `minVisibleWidth`, `overdrawPx`) and dotplot `lineWidth` against
     `strokeWidth`
   - the density and zoom gates (`max*FeatureDensity`, `marks[].minBpPerPx`,
     `maxBpPerPx`) and `minWidthPx`
   - the multi-way booleans (`showLaneTicks`, `splitStrands`,
     `inlineLaneNames`)
   - the contradiction on filter defaults: ADR-238 says a written list drops
     defaults it omits; ADR-240 says it merges by field
   - `data.resolution`, which carries three meanings after the 10-23
     amendment
   - `rect` against `span`: config says `rect`, render-core keeps `span`, and
     `website/release_announcement_drafts/v5.0.0.md` still says `span`
   - the closed-schema policy: a `displayDefaults` member fails the track and
     a `displays` entry warns (ADR-134, ADR-221)
5. **Generate the writers.** The jbrowse-img modifier tables, the `jb`
   surface description and the R export lag every rename because hand-kept
   copies drift. Derive each from the schema.
6. **v4.3.0 coverage count.** Run `jbrowse validate` over the v4.3.0 demo and
   tutorial configs and record how many load. That count is the compat claim.
7. **Writers outside the tree.** jb2hubs and its hosted configs, the ggjbrowse
   pin, the graph plugin, the `apollo3` demo and the figure specs
   (`handoffs/screenshot-spec-elegance.md`).
8. **Plugin ABI.** Curate the served list so internals nobody reads (shader
   constants) stop reaching plugins. Baseline `reExports.generated.json` and
   the exports map at the release candidate
   (`reference/PLUGIN_ABI_STABILITY.md`). Decide whether `@jbrowse/tables` and
   `@jbrowse/launch-args` ship at 5.0.0 or 0.x.

## Release candidate gates

- The meter reads near zero for 14 days.
- Every `retired` entry maps a v4.3.0 name.
- `jbrowse validate` reports no warning on hosted configs, `demos/` and the
  tutorials.
- The v5 release draft and the schema use the same spellings, including the
  word "experimental" for `LinearMarkDisplay`.
- A migration page generated from the `retired` maps exists, and CHANGELOG has
  a v5 section.
