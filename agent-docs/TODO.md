superAfterAttach might not be needed

  1. Lift the afterCreate orchestration into named actions. Right now afterCreate has an inline IIFE that does two phases (config + session). Extract:

  async loadConfig() {
    if (self.configSnapshot) {
      await self.fetchPlugins(self.configSnapshot as { plugins?: PluginDefinition[] })
    } else {
      await self.fetchPlugins(self.configSnapshot as { plugins?: PluginDefinition[] })
    } else {
      await self.fetchConfig()
    }
  },
  async initialize() {
    try {
      await this.loadConfig()
      await this.loadSessionByType()
    } catch (e) {
      console.error(e)
      self.setConfigError(e)
    }
  },
  afterCreate() { void this.initialize() },

  Reads as a sequence, the IIFE goes away, and both phases get standalone names. Small but clarifies the lifecycle. Recommend.

  2. Move the loader-reload constructor out of Loader.tsx. That inline SessionLoader.create({ ...getSnapshot(prev), ... }) is essentially "construct a SessionLoader from a previous one + fresh snapshots". It belongs next to SessionLoader, not in React:

  // in SessionLoader.ts
  export function reloadSessionLoader(
    prev: SessionLoaderModel,
    configSnapshot: Snap,
    sessionSnapshot: Snap,
  ) {
    return SessionLoader.create({
      ...getSnapshot(prev),
      initialTimestamp: Date.now(),
      configSnapshot,
      sessionSnapshot,
    })
  }

  Loader.tsx's reloadPluginManager becomes a one-liner. Knowledge of how to build a SessionLoader lives in one place. Recommend.

  Tradeoff calls

  3. Move the as casts inside fetchPlugins/loadSession. Currently the two callers each do self.configSnapshot as { plugins?: PluginDefinition[] }. Could move inside the function: async fetchPlugins(config: Snap | undefined) and cast internally. DRYer but hides
  unsafety. I'd say leave — explicit at call sites is more honest about the snapshot's loose type, and it's only two duplications.

  4. The error getter inconsistency. loader.error returns configError || sessionError but ignores pluginManagerError. Loader.tsx therefore does its own combination. Either (a) update error to include all three (consistent), or (b) delete the getter and have
  callers be explicit. I'd lean toward deleting error — it's only used in tests and creates the false impression that it's the canonical error.

  Probably not worth it

  5. Dispatch table for loadSessionByType. Tempting but the branches differ too much (sync vs async, some setBlankSession, the hub-and-blank pairing). Replacing the if-else with a map would obscure that.

  6. Setter consolidation. All those one-line setter actions are MST boilerplate. Generic helpers lose type safety. Leave.

  7. isConfigLoaded. Only referenced in tests, never in production code. Could be deleted (and the two tests removed) — but it's part of the documented #getter API surface. Removing risks breaking external consumers we don't see. Leave unless you want me to grep
  harder.

  Bigger structural change (NOT recommending unless you want it)

  8. Split SessionLoader into two models. It conflates two distinct phases: (a) URL/storage decoding + plugin loading, (b) pluginManager build/dispose lifecycle. They share state but the responsibilities are different. A SessionLoader (a) + PluginManagerHost (b)
  split would be conceptually cleaner but would force passing data across a boundary that's currently free. Not worth the churn unless you're already planning to overhaul this area.

##Next
  - Sort state in SourceGrid — still uses the idx % 2 flip-flop. A 5-line cleanup to direction: 'asc'
  | 'desc', didn't seem worth interrupting the bigger unification for.
  - Variants doesn't yet have an editableSources-equivalent — irrelevant today (no overlay synthesis
  to leak), but if variants ever grows a subtree filter that applies to model.sources, the dialog
  would inherit the same persist-only-filtered-set bug we just fixed in wiggle. The model: { sources }
   contract makes it a one-line wrapper change when needed.
  - MAF: I noticed MAF in the changed-files list at session start but didn't audit it for the same
  source-management patterns. Worth a separate pass if it has a multi-sample editor.


## MAF


Replacing alignments' local ResizeHandle with core's — I was wrong about this being cleanup. The
  local one is wired into a dragControllerRef shared with pan and scrollbar drags, so a single drag
  can abort the previous, and isDragInProgress(controllerRef) skips hit testing while resizing. Core's
  hit-tests run during resize. Real architecture, not duplication. MAF doesn't have that integration
  so core's ResizeHandle is fine there. The drag 'abort controller' isnt a big deal to me please align with core reseizehandle unless truly there is some reason not to

  About per-cell hover: previously stubbed and dead. Coverage band hover now works (depth + per-base
  SNP counts). Per-cell hover (sample name + base at position) still doesn't exist — that's net new
  feature work (~80 lines: MAF cell hit test + payload). Worth doing if you want feature parity with
  the implied behavior of the old stub; let me know. yes, we want per-cell hover if possible



## test speedups
  You were right that the import graph is the problem — but it's only ~⅓ of the cost.

  ┌──────────────────────┬─────────┬───────┐
  │       Variant        │ Modules │ Time  │
  ├──────────────────────┼─────────┼───────┤
  │ Pure noop test       │       1 │ 0.73s │
  ├──────────────────────┼─────────┼───────┤
  │ 5 plugins            │     381 │ 2.58s │
  ├──────────────────────┼─────────┼───────┤
  │ Current (30 plugins) │   1,512 │ 3.33s │
  ├──────────────────────┼─────────┼───────┤
  │ Real test (10 tests) │  1,512+ │ 11.3s │
  └──────────────────────┴─────────┴───────┘

  The math for a 2× warm-cache win:
  - Trim corePlugins to per-test minimum: saves ~0.7s/file → ~10% on heavy tests, ~25% on light tests
  - Share JBrowse mount across tests in same file: saves ~3–5s per heavy file
  - Combined: realistic path to ~1.6–1.8×. Honest 2× requires both.

  SWC / esbuild / Vitest: 0% local warm-cache help. Confirmed by profile (babel is 1.8% CPU on real
  tests).

  What I'd actually do, in order:
  1. Make getPluginManager() in util.tsx accept a plugin list (default = corePlugins). Migrate the
  lightest tests to pass [LinearGenomeView, Config, Menus, Sequence, DataManagement]. Quick win, low
  risk.
  2. Audit one heavy plugin barrel (e.g. linear-comparative-view/src/index.ts reaches 504 files) to
  see if non-lazy imports can become lazy() — would benefit all tests.
  3. Only then consider sharing mounts across tests — bigger refactor, harder to keep correct.

  If you want, I can do step 1 as a real PR (refactor util.tsx + convert ~5 light tests) and measure
  the suite delta.

