---
name: have-gettrackyoffset-return-undefined-when-offset-labels-are-showing-so
description: Have `getTrackYOffset` return `undefined` when offset labels are showing, so a caller cannot silently take a short answer
area: rendering-and-displays
---

# Have `getTrackYOffset` return `undefined` when offset labels are showing, so a caller cannot silently take a short answer

declined 2026-09-03. The
signature was already `number | undefined` and the one consumer read
`domYOffsets?.[level] ?? viewTop + (view.getTrackYOffset(trackId) ?? 0)`,
so the missing number became `viewTop + 0`: "this body starts at the top of
the row", the exact failure `BreakpointSplitViewOverlay` measures `undefined`
rather than `0` to avoid. Making it honest meant a nullable `OverlayLevel.yOffset`
and every overlay kind's drop path, larger than the fix. The band is measured
into `trackLabelBands` instead, which also fixes `height`, which carried the
same omission and left a multi-row fallback short by every band above.
