---
name: an-r-tab-in-the-figure-recipe
description: A recipe derives Notebook (Python) and Embed (React) tabs from the session spec, and nothing derives R. `JBrowseRApp()` takes `createApp`'s options verbatim, so the snippet is the notebook one in R once an R reader can fetch a hosted config with its relative URIs stamped.
---

# An R tab in the figure recipe

Filed 2026-11-09, after the Embed tab landed.

`website/src/lib/spec-recipe/recipe.ts` builds `python` (`pythonSnippet`, for
jbrowse-anywidget) and `embed` (`spec-recipe/embed.ts`, for
`@jbrowse/react-app2`) from one session spec, and `spec-recipe/html.ts` draws a
tab for each. A fence that opens a `spec-` session takes the same tabs
(`remark-config-cli-tabs.ts`). An R reader gets neither.

What is known:

- `JBrowseRApp()` (`~/src/JBrowseR/R/app.R`) sends every named argument to
  `createApp` under its own name: `assemblies`, `tracks`, `views`,
  `aggregateTextSearchAdapters`, `configuration`. Those are the options the
  Python and React snippets pass, so the R snippet is the same call with
  `list()` literals.
- The Python snippet opens the figure's config with jbrowse-anywidget's
  `fetch_hub`, and the React one with `fetch` plus `addRelativeUris`. JBrowseR
  exports no equivalent that I found (`grep hub NAMESPACE` is empty), and
  `jsonlite::read_json(url)` alone leaves the config's relative file URIs
  resolving against the page.
- The `needsPlugin` decision in `recipe.ts` already says which figures get no
  snippet, and should carry over unchanged.

What to do:

- Check how a JBrowseR user loads a hosted `config.json` today, and add a
  `fetch_hub` twin to JBrowseR if there is none.
- Add `rSnippet` beside `pythonSnippet`, an `r` field on `Recipe`, and a panel
  of kind `r` after Notebook. The R literal printer is the one new piece of
  code: a JSON array of objects is `list(list(...))`, and a JSON array of
  strings a reader may want as `list("a", "b")` rather than `c("a", "b")`,
  since jsonlite turns a length-one vector into a scalar.
- Run one generated snippet in R before landing, as the Embed snippet was run
  in the examples site: export-name tests do not show that a view opens.
- `website/scripts/check-embedding-docs.ts` holds the docs' Python and R blocks
  to what the two packages provide; point it at the generated snippet's calls.

ggjbrowse is the other R surface. It draws static ggplot2 figures and has no
session-spec reader, and its twin tutorials under
`~/src/ggjbrowse/docs/tutorials` are hand-written, so a derived ggjbrowse tab is
a larger piece of work than this one and is not proposed here.
