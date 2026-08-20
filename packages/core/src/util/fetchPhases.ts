/**
 * The three phases a single-payload fetch is written in, so the rules that
 * strand a display when any of them is got wrong are structural rather than
 * remembered.
 *
 * Two of the three fetch families take this shape — the LGV global one
 * (`installGlobalFetchAutorun`, over `FetchMixin.runFetch`) and the comparative
 * one (`installComparativeFetchAutorun`, over its own
 * `createStopTokenRotation`). They were the same contract declared twice, with
 * the same three rules explained twice, which is a drift axis over rules whose
 * whole value is being the same everywhere.
 *
 * `TCtx` is what each family hands its `run`: a `FetchContext` on the LGV side,
 * a `ComparativeFetchContext` (adapter config, session id, refName rename) on
 * the other. That is the one thing that genuinely differs, so it is the one
 * parameter.
 *
 * **The per-region family is deliberately not this shape.** N regions stream and
 * four displays decide something across them mid-fetch, so there is nowhere to
 * put a single `commit` — it gets the same "never record what you did not
 * receive" invariant from `RegionFetchContext.commitRegion` instead, and the
 * note there is worth reading beside this one.
 */
export interface FetchPhases<TArgs, TResult, TCtx> {
  /**
   * Runs synchronously inside the autorun, so its reads — on top of the
   * skeleton's own trigger list — are the dependency set. Returning `undefined`
   * skips the run (minimized, an empty viewport, the display's own gate shut);
   * the reads that decided that stay tracked, so the autorun rewakes. Everything
   * the round trip has to be judged against is captured here and travels in
   * `TArgs`: the viewport, the region set, the resolution.
   *
   * Prefer folding the fetch's inputs into one `currentFetchKey` computed over
   * tracking them individually: a pan inside the buffered window then recomputes
   * the same string and does not refire, and that same string tags the committed
   * data so it cannot drift from what was fetched even if the view moves again
   * mid-RPC.
   *
   * What it must **not** do is move a trigger read of its own under a bail-out.
   * See ARCHITECTURE.md §"The global-fetch trigger list must be read
   * unconditionally".
   */
  prepare: () => TArgs | undefined
  /**
   * Owns every await — the RPC, a byte-gate pre-flight, any post-RPC derivation
   * the commit needs — and writes nothing to the model. Returns `undefined` for
   * "nothing to commit", which is what a pre-flight that stopped this fetch
   * says.
   *
   * **Nothing it reads is tracked**, so the payload it assembles cannot widen
   * the autorun's dependency set the way calling `rpcProps()` in the body would.
   * Being async is not what buys that — `run` is *called* synchronously, so its
   * own prefix down to its first `await` runs wherever the caller was. Each
   * family arranges it: the global one reaches `run` through
   * `FetchMixin.runFetch`, an MST flow and so an action, which MobX runs
   * untracked; the comparative one calls its lifecycle inside `untracked`
   * because it has no action to hide behind.
   */
  run: (args: TArgs, ctx: TCtx) => Promise<TResult | undefined>
  /**
   * Synchronous, and reached only while this is still the latest fetch, so a
   * superseded fetch resolving late cannot clobber fresher data. Async work here
   * would reopen exactly that window, which is why it may not await. It takes
   * `args` back, so what it stamps onto the committed data is what the fetch was
   * issued for and not a live re-read.
   *
   * **Reached only when `run` produced a result**, which is what keeps a display
   * from ever recording data it did not receive.
   */
  commit: (result: TResult, args: TArgs) => void
}
