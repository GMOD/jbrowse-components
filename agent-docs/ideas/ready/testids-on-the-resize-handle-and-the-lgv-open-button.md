---
name: testids-on-the-resize-handle-and-the-lgv-open-button
description: Two controls a tour would click publish no selector, the track resize handle and the linear genome view import form's Open button, so a tour must drag by measured pixels or click a label that prefixes other buttons.
---

# Testids on the resize handle and the LGV Open button

- `ResizeHandle`
  ([ResizeHandle.tsx](../../../packages/core/src/ui/ResizeHandle.tsx)) is a bare
  `<div>` with emotion classes. A track-height drag can only target measured
  pixels, which the tour specs refuse, so no tour drags a track's height.
- The linear genome view import form's **Open** button
  ([ImportForm.tsx](../../../plugins/linear-genome-view/src/LinearGenomeView/components/ImportForm.tsx))
  has no testid, and `Open` is a prefix of `Open from a URL`, `Open track...`
  and `Open file from URL or local computer`. A text click lands on the first
  element containing the word; `videos/sv.ts` records what that cost on the SV
  inspector's form, whose button has a testid.

## The change

A `data-testid` on each.
