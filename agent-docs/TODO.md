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



