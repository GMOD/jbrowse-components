### Derive wiggle `isCacheValid` from BigWig zoom levels

**Problem:** Wiggle uses strict `view.bpPerPx === loadedBpPerPx` equality for
cache invalidation (ADR-008). Any zoom step refetches all visible regions
simultaneously, even when the BigWig zoom level didn't change — i.e. the
returned data would be identical.

**Fix:** `BigWigAdapter` exposes a `zoomLevelForBpPerPx(bpPerPx)` method that
returns the discrete zoom level index BigWig would use. `isCacheValid` in
`LinearWiggleDisplay` compares zoom levels rather than raw bpPerPx. Zoom moves
within the same BigWig tier no longer refetch.

**Risk:** Need to audit zoom-level selection logic in `@gmod/bbi` to ensure the
mapping is stable and deterministic. If zoom level is ambiguous at boundary
bpPerPx values, strict equality is still safer.

Challenge: multiwiggle

Unclear if this is truly doable or worth it
