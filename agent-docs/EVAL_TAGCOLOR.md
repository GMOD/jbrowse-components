A previous agent was working on our system for rendering specific reads in plugins/alignments based on
  tags. critically evaluate their summary and continue work on any additional items   Summary

    The fix is implemented, type-checks clean, all unit tests pass (268), and the in-browser HP-tag + full
    color-scheme suite passes against the committed goldens — confirming the refactor is pixel-identical (it
    relocates where colors are baked, not the colors themselves).

    What changed (Approach A)

    - Worker (executeRenderAlignmentData / extractFeatureArrays): stops baking colors. Emits raw per-read
  tag
    values (readTagValues, parallel to the existing readIds/readNames) and leaves readTagColors empty.
    colorTagMap no longer crosses the worker boundary.
    - Main thread (readTagColors.ts, new): overlayReadTagColors bakes readTagColors inside the
  laidOutPileupMap
    getter from readTagValues + colorTagMap. buildTagColors moved here verbatim from the worker.
    - rpcProps(): colorTagMap removed → writing it can never trigger SettingsInvalidate → clearAllRpcData.
  The
    discover→assign→refetch loop is now structurally impossible, not guarded. The explicit
    invalidateLoadedRegions() second-pass is deleted; the one fetch suffices (tag coloring is now tier-2,
    matching LinearAlignmentsDisplay/CLAUDE.md).
    - Renamed the orphaned shared/buildTagColors.ts → extractFeatureTagValue.ts (its only remaining export).

    Final-pass evaluation — is this optimal/simple?

    - colorTagMap stays an imperative MST accumulator, not a pure getter. I considered making it derived. It
    can't be: assignment is sticky across region load/unload (palette slot = order of first discovery), so a
    pun on the current rpcDataMap would recolor reads as you pan. The accumulator is correct and
  intentional.
    - Overlay placement. Baking lives in laidOutPileupMap rather than threaded through the layout functions
  —
    this keeps all tag-color logic isolated in one file and leaves cloneWithLayout/chain layout untouched.
    Cost: in tag mode each region's data object is shallow-spread twice (once by layout clone, once by
    overlay). That's per-region (typically 1–3), not per-read; the actual O(reads) bake runs once. Non-tag
  mode
    is a zero-allocation early return. I judged isolation > avoiding 1–3 object spreads.
    - readTagValues as string[]. Structured-cloned, not transferable — but readIds/readNames already
  dominate
    that cost, and we traded two full fetches for one. A transferable Uint16Array of indices into
  newTagValues
    would shave the clone, but it adds empty-value/sentinel bookkeeping for a non-bottleneck. Flagged, not
  done
    (premature).

    Related concepts worth knowing about

    - sortTagValues is the pattern this now matches. Tag sort already did it right: the worker sends raw
    per-read tag values and the main thread does the work (sortLayout). Tag color was the lone inconsistency
    that baked in the worker. They're now symmetric.
    - modificationColors / modCovColors / snpColorTypes are also worker-baked ABGR — but they do NOT need
  this
    treatment. They derive from fixed palettes + MM/ML tags + colorBy.threshold, i.e. only from inputs the
  user
    sets directly, never from worker output fed back in. No circular dependency, so no loop. They are
    correctly worker-side.
    - Insert-size coloring is already ideal: the worker computes a raw stat (insertSizeStats) and the shader
    colors per-read from a uniform — no baking, no loop.

    The general rule this surfaces (now recorded in LinearAlignmentsDisplay/CLAUDE.md): anything in
  rpcProps()
    that is also derived from worker output is a feedback loop by construction — the cure is to send raw
    per-read values out and do the derivation on the main thread.

    I did not commit — let me know if you'd like that, and whether to regenerate/commit the snapshot goldens
    currently modified on this branch.

