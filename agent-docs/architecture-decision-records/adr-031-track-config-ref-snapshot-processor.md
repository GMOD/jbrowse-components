# ADR-031: TrackConfigurationReference keeps the snapshotProcessor wrapper

## Status

Accepted

## Context

`TrackConfigurationReference` in `packages/core/src/configuration/configurationSchema.ts`
wraps a `types.union(trackRef, schemaType)` with `types.snapshotProcessor` whose
`postProcessor` squashes any serialized output containing a `trackId` field
down to just the id string. It looks superficially redundant: the inner
`types.reference(...)` already has a `set(value) => value.trackId` that
serializes a ref as the id string.

The wrapper was removed in commit `13ac58f56` ("Snapshots"), which
simultaneously added a unit test
(`configurationSchema.test.ts` — TrackConfigurationReference inline-object
case) asserting that inline-object input still serializes as an id string. The
test comment explicitly says "Don't drop the union/postProcessor — this path
depends on it." That commit was internally inconsistent: it dropped the
wrapper *and* added the test, leaving the test failing on `webgl-poc` HEAD.
This ADR documents the reasoning and reinstates the wrapper.

## Two input paths

The union dispatcher routes by input shape:

| Input                                        | Branch       | Serialization without wrapper |
|----------------------------------------------|--------------|--------------------------------|
| `"some-track-id"` (string)                   | `trackRef`   | `"some-track-id"` (via `set`)  |
| `{ trackId: "x", name: ..., ... }` (object)  | `schemaType` | full object snapshot           |

For the string path, the `trackRef.set` already returns just the id, so the
wrapper is a no-op. **For the object path, the wrapper is load-bearing** —
without it, the saved session contains the full inline track config (and a
duplicated `trackId` that conflicts with the canonical entry in
`jbrowse.tracks`).

## Real callsite

`DotplotView` spawning a `LinearSyntenyView` passes
`configuration: getSnapshot(trackConf)` rather than a trackId string (the
inline track config has no canonical home in `jbrowse.tracks` because it's a
synthesized synteny track). The schema branch instantiates the inline object;
without the snapshotProcessor, that full object would re-serialize into the
session export and round-trip back as a duplicate identifier.

The session-export shape isn't a behavioral invariant the type system
enforces; it's enforced by this test and this wrapper. Both must stay aligned.

## Why not just always go through trackRef

A `types.reference` requires the target to already exist in the tree at
hydration time. The dotplot path passes the snapshot *before* the track is
registered — using `trackRef` directly would throw "Could not resolve
identifier". The union exists precisely so this path can succeed by
instantiating a detached schema node; the snapshotProcessor exists to
normalize the output of that detached node back to an id string.

## Symmetry with DisplayConfigurationReference

`DisplayConfigurationReference` deliberately does NOT use snapshotProcessor —
historically that triggered "setConfig is not a function" errors on
sub-displays (PileupDisplay et al.). The asymmetry is intentional but
poorly understood; the original call site that surfaced the failure is no
longer in the codebase. Until that's investigated and proven safe, leave
display refs unwrapped and track refs wrapped.

## Decision

Keep `types.snapshotProcessor` on `TrackConfigurationReference`. Do not
generalize the wrapper to `DisplayConfigurationReference` without first
proving (via tests + integration) that the historical setConfig failure is
gone.

## Consequences

- Session exports stay compact and round-trip cleanly through the dotplot →
  synteny inline path.
- The wrapper is no-op overhead for the common string-id path; not a hot
  path so the indirection cost is negligible.
- Future agents reading the code will notice the seeming redundancy and want
  to simplify. The test + this ADR + the JSDoc on the function are three
  signals pointing at the same load-bearing invariant — if you want to
  remove the wrapper, you need a different design for the inline-object
  serialization (e.g. an explicit `setConfig` action on the holder model
  that flattens before assignment).
