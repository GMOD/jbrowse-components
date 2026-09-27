---
name: tutorial-exporting-figures
description: A figures tutorial that leads with exporting from the app (SVG export, the figure recipe dialog) and demotes jbrowse-img and URL automation to a later section for repeating a figure across loci. No tutorial mentions jbrowse-img; docs/automating.md already carries the URL-and-CLI half.
---

# Tutorial: exporting figures

Split out of the tutorial-ideas audit on 2026-09-27.

No tutorial mentions `jbrowse-img`. The FAQ has both "How do I make an image
for a publication" and "How do I automatically create screenshots", and
`docs/jbrowse-img.md` is generated from the product README, so the tutorial is
the missing narrative layer: a session to a committed PNG or SVG, batching a
figure panel, and where SVG export fits against the CLI tool.

**UI first** (Colin, 2026-07-26): lead with exporting from the app and demote
URL and CLI automation to a later section for people repeating a figure across
loci or samples. `docs/automating.md` already grew the `init` fields, URL
params, embedded `createViewState`, config and session files and a headless
section, so the page is smaller than first proposed. Write menu paths with the
unicode arrow, checked against the menus that build them, and prefer the figure
recipe dialog wherever a figure exists: it derives its click-path from the
figure's own session link, so it cannot go stale.
