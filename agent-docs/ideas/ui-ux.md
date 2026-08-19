---
name: ui-ux
description: Loose UI threads: height-resize gestures, a canvas offscreen buffer, super-compact mode, side labels for genes, global scrollZoom, and a search advanced panel whose surface was never decided.
---

# UI / UX

**Height resize.** Double-click resize handle, drag to resize, prevent shrinking,
auto-shrink toggle.

**Canvas offscreen buffer.** Margin rendering to avoid feature re-juggling on small
pans/zooms (like `plugins/sequence`).

**Super-compact mode** for very dense gene annotations (pack features even tighter).

**Side labels for genes.** Gene-name labels in the left/right margin instead of inline.

**Global scrollZoom.** Per-view → global setting.

**A search advanced panel.** Carried over from a two-line `search-misc` note that
said it "may need a pagefind inverted index". If that meant the *website* docs
search, the premise is already met — pagefind backs it today (`pnpm index`,
`static/pagefind/`), so what is left is only the panel. If it meant the app's own
search box, pagefind is the wrong tool and the note never said which. Decide
which surface before costing it.
