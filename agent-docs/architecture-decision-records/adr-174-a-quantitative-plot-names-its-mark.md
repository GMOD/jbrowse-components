---
status: Accepted
summary: "`LinearWiggleDisplay`'s `defaultRendering` becomes `mark` (`bar`, `point`, `line`, `heatmap`) and `interpolate` (`step`, `linear`, a line's alone), the mark display's and Vega-Lite's words for the same pictures. `density` was a heat strip under a name the density tier and a mark's `source: 'density'` use for a feature count, so it is `heatmap`, as MAF's menu already called the geom. The five renderings stay the shaders' internal names; `renderingOf` and `markOf` are the one translation, the menu's labels are unchanged, and the display declares `defaultRendering` retired"
---

# ADR-174: A quantitative plot names its mark

## Status

Accepted (2026-09-26). Colin chose "wiggle uses mark words" and `heatmap` for
the heat strip.

## Context

The wiggle display spelt its geom `defaultRendering: xyplot | density | line |
linecenter | scatter`, a mode-era slot beside a mark display that says
`mark: 'bar' | 'point'` for the same bars and points. `density` named a strip
coloured by score, where the density tier and a mark's `source: 'density'`
mean a count of features per bin; MAF's row menu called the same geom
"Identity heatmap". Two lines were two renderings where Vega-Lite has one line
and an `interpolate`.

## Decision

`mark` holds `bar`, `point`, `line` or `heatmap`, and `interpolate` holds
`step` or `linear`, read by a line alone. `renderingOf(mark, interpolate)` is
the rendering the shaders, the marks and the tests keep calling `xyplot`,
`scatter`, `density`, `line` and `linecenter`, and `markOf` the reverse, which
`setRenderingType` writes through and the `retired` map reads a v4 name
through. An unknown old name lifts as a `mark` the enumeration refuses, so a
typo stays loud.

## Consequences

- Every in-tree config, figure spec, example and guide writes `mark`; the Plot
  type menu keeps its five labels.
- jbrowse-img's `fill` flag writes `mark`, and the JBrowse 1 converter a `bar`
  or `heatmap`.
- The internal rendering names stay, since renaming them reaches every shader
  and some 200 lines of tests for no reader.
