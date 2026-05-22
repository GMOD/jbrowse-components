  1. Consolidate installPerRegionWiggleLifecycle into installPerRegionGpuLifecycle. They're now near-duplicates —
  wiggle's only difference is keeping the encoded-sources map in a closure and passing it to renderBlocks.
  Generalize: add an optional getRegions: () => ReadonlyMap<number, Encoded> hook to the core helper that the
  render callback can pull from. Then wiggle calls the same core helper as every other plugin. Saves ~60 lines and
  eliminates the "why does wiggle have its own?" question.

  2. Lift startGpuBackendLifecycle action into a helper. Five plugins now have essentially identical bodies:
  startGpuBackendLifecycle(backend) {
    installPerRegionGpuLifecycle(self, self.rpcDataMap, backend, encoder, b => {
      const state = self.renderState
      if (!state) return false
      b.renderBlocks(self.renderBlocks, self.rpcDataMap, state)
      return true
    })
  }
  A helper startPerRegionLifecycle(self, backend, { rpcDataMap, renderState, renderBlocks, encode }) collapses each
   plugin's action to one line. Trade-off: another layer of indirection. Probably worth it once you have 5+
  identical bodies; risky if the shape diverges.

  3. Reconsider the @jbrowse/wiggle-core package boundary. Now that PerRegionGpuBackend lives in @jbrowse/core/gpu,
   WiggleBackend is just PerRegionGpuBackend<SourceRenderData[], WiggleGPURenderState, WiggleRenderBlock>. The
  cross-plugin wiggle contract is now mostly types that could move into @jbrowse/core/gpu or back into the wiggle
  plugin. GWAS would still need the shared scale/normalize utilities, but those are pure functions, not a package
  boundary issue. Not urgent, but worth a look on the next package cleanup pass.

  The strongest of these is #1 — the wiggle-specific lifecycle is the last bit of asymmetry left in this refactor,
  and unifying it would mean every per-region plugin uses the same pair of files (PerRegionGpuBackend interface +
  installPerRegionGpuLifecycle helper) end to end.

