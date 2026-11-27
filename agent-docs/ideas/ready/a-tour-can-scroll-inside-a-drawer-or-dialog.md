---
name: a-tour-can-scroll-inside-a-drawer-or-dialog
description: A video tour's `scrollTo` only scrolls the views' container, so a tour whose subject is a drawer, a dialog or a scrollable field inside one cannot scroll it; a `scrollWithin` step naming a selector covers all three.
---

# A tour can scroll inside a drawer or dialog

`scrollPage` ([video-overlay.ts](../../../website/scripts/video-overlay.ts))
walks up from `[data-testid^="view-container-"]` to the nearest scrollable
ancestor, so on a tour whose subject is a drawer or a dialog it scrolls the
views instead. The only lever today is a taller viewport.

One level in, a scrollable field inside a dialog moves only by clicking into it
and pressing PageDown, which works because a textarea has a real caret.
`config/settings_to_json`
([videos/config.ts](../../../website/scripts/videos/config.ts)) met this and
chose not to scroll its JSON panel at all, so no current tour is blocked; the
next tour whose subject is a drawer is.

## The change

A `scrollWithin` step taking a selector and a target (`number | 'bottom'`),
scrolling that element with the easing `scrollPage` uses.
