---
name: tutorial-notebooks-python-and-r
description: A notebook tutorial covering jbrowse-anywidget and JBrowseR together — compute in the kernel, put the bytes behind a track with add_local_file, set location, read it back after the user pans. Unblocked since resolveAssemblies moved to product-core; a narrative over the existing example notebooks rather than new material.
---

# Tutorial: notebooks, Python and R

Split out of the tutorial-ideas audit on 2026-09-27.

`jbrowse-anywidget` (`~/src/jbrowse-anywidget`) and JBrowseR (`~/src/JBrowseR`)
are both being revitalized, so the tutorial covers both. Today
`docs/jbrowse_anywidget.md` describes the anywidget and several tutorials embed
copy-paste snippets, but nothing teaches the loop: compute in the kernel, put
the bytes behind a track with `add_local_file` (no web server), set `location`,
read it back after the user pans. `docs/jbrowse_anywidget.md` already calls the
anywidget the replacement for the Dash-based `jbrowse-jupyter`, so don't send
readers to the old package.

It is unblocked: `resolveAssemblies` moved to product-core, so
`JBrowseApp(assemblies=["hg38","mm39"])` and
`JBrowseRApp(assemblies = list("hg38","mm39"))` both work, `localFiles`
registers on the app widget, and both hosts render a visible error. The
anywidget's `examples/` and JBrowseR's Colab notebooks and vignettes are the
runnable material, so the page is narrative over what exists.

The two-way half is single-view only — `JBrowseApp`'s `view_locations` is
read-back only and every config trait rebuilds the app
(`~/src/jbrowse-anywidget/agent-docs/IDEAS.md`), so don't write the page around
panning a synteny view from Python. It is a forward bet rather than
demand-driven: one discussion ever
([TUTORIAL_DEMAND.md](../../reference/TUTORIAL_DEMAND.md)).
