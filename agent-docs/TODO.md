# Active Work Items

## TubeMapView: node-width scaling control (`widthPerBp`)

`widthPerBp` is a volatile field (default 10) that controls how many CSS pixels
each bp of sequence contributes to a node's rendered width. Currently it is
hardcoded — there is no UI to change it. Adding a control would let users expand
dense graphs (many short nodes) or compress sparse ones without changing the
pan/zoom transform.

**Suggested implementation:**
- Add `setWidthPerBp(v: number)` action to the model (clamp to e.g. 2–50).
- Add `rawGFA: string` volatile field; store the text in `applyGFA` so re-layout
  on `widthPerBp` change doesn't require a round-trip for file-loaded views.
  Track-loaded views can re-run the RPC instead (reuse `loadFromTabixSubgraph`).
- Re-run `layoutGFA(parseGFA(self.rawGFA), self.widthPerBp)` inside `setWidthPerBp`.
- Add a labeled slider or `+`/`-` pair to `TubeMapToolbar` (label: "Node width").
- Keep the existing `scale`/`translateX`/`translateY` transform independent —
  `widthPerBp` changes layout geometry, zoom/pan just moves the viewport.

**Files:** `model.ts` (`widthPerBp`, `rawGFA`, `applyGFA`), `TubeMapToolbar.tsx`

---

## `gfaParser.ts`: surface errors for malformed input

`parseGFA` in `packages/graph-core/src/gfaParser.ts` silently drops or produces
garbage for malformed lines (non-null assertions on split fields, unvalidated
`+val` conversions returning `NaN`, unknown record types ignored with no warning).
A user uploading a truncated or wrong-format file sees a blank canvas with no
feedback.

**Suggested implementation:**
- Wrap the per-line parsing block in a `try/catch` and collect parse warnings
  rather than crashing or silently skipping.
- Return `{ graph: GFAGraph, warnings: string[] }` from `parseGFA` (breaking
  change — both callers need updating: `TubeMapView/model.ts:applyGFA` and
  `GraphGenomeView`).
- Surface non-empty `warnings` in the view's status/error banner after load
  (e.g. "Loaded with 3 parse warnings — see console").
- Validate `+val` conversions: `Number.isNaN(result) ? undefined : result`.

**Files:** `packages/graph-core/src/gfaParser.ts`, both view model files,
`TubeMapView/components/ImportForm.tsx` (display warnings), `gfaParser.test.ts`
(add malformed-input cases).

---

**Updated:** 2026-05-07 | PRD.md holds invariants; this file is the categorized backlog.






## The synteny import form


Not working/overcomplicated ui now


## Synteny canavs export

- Use normal bezier drawing in svg export/canvas
- Try to improve beziers a bit in webgl/webgpu
- Significantly more pixel artifacts in webgl/webgpu when zoomed out
- Unclear how to reproduce: was side scrolling a lgv, synteny view was not updating, and gene glyphs were gone. maybe from lost context

