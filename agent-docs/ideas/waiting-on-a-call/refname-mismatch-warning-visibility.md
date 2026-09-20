---
name: refname-mismatch-warning-visibility
description: The refName-mismatch warning is the only signal that a track's file and its assembly share no names, and it mounts from the track label — so hiding labels, or exporting SVG, puts the commonest data mistake back to looking like an empty track. Where else it could live, and why the display chrome was rejected once already.
---

# Where the refName-mismatch warning lives when there is no label

`BaseTrackModel`'s `refNameMismatch` getter has exactly one reader,
`TrackLabelRefNameWarning.tsx`. That component mounts only from
`TrackLabel.tsx`, and `TrackContainer.tsx` renders the label under
`model.effectiveTrackLabels !== 'hidden'`. So with labels hidden — a setting
people reach for on a dense view, and the one figures are shot at — a track
whose file uses `1` against an assembly using `chr1` draws nothing and says
nothing. That is the same silence the warning was written to end. SVG export
never renders it either, so a published figure of a misconfigured track carries
no mark at all.

The obvious move — put it in the display chrome — was considered and rejected
when the warning was built, and the reasoning still holds: the chrome's states
are `displayPhase`'s, they are mutually exclusive, and two of them replace the
display's subtree. A mismatch is neither an error to retry nor a phase to be in,
and routing it through `model.error` puts a red banner and a dead Retry over a
track that may be drawing fine if the check is ever wrong. That argument rules
out the phase machinery, not a badge.

Three placements worth weighing:

- **A badge in the overlay layer.** `TrackContainer` already mounts
  `TrackOverlaySlot`, which marks the whole layer `data-gesture-owner` and takes
  no pointer events until a child asks for them. A small warning button pinned
  top-left there reaches every track type at once, exactly as the label version
  does. The trap to check first is the portal one: React events do not stop at a
  portal, so a button floated over the canvas has its clicks reach the display's
  hit test unless it takes the events back the way `TrackOverlayPortal`
  documents.
- **The view header.** One badge summarizing "3 tracks have no matching
  reference names", which survives hidden labels and costs each track nothing.
  It is further from the track it is about, which is most of the warning's
  value.
- **Draw it.** A watermark in the rendered output is the only placement that
  reaches SVG export, and export is half the reported problem.

The release notes claim this case is covered. Whatever lands, the claim needs
to become true or come out.

Adjacent: the check itself is fine — it is the surface that is missing. Do not
re-derive the getter.
