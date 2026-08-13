---
name: configuration-spec-layer
description: ConfigurationLayer, adapter shorthands, and the declarative spec.
---

# Configuration & spec layer

**ConfigurationLayer (fanciful).** A construct that acts as a "layer over" another
config schema: same slots/types, but every slot's default is whatever the parent
schema's *current value* happens to be. Use case: cascading config for subtracks
where a child overrides a handful of slots and inherits the rest dynamically. Never
built; the current `baseConfiguration` extension covers most of the practical need
(inherits the *schema*, not the live values).

**Adapter-wrapper shorthands.** `refNameAliases`/`cytobands` still require the
full `{ adapter: { type: 'RefNameAliasAdapter', uri: '...' } }` wrapper — a
`refNameAliases: { uri: '...' }` shorthand (defaulting `adapter.type`) would trim
that via the same `preProcessSnapshot` idiom already in place there. Riskier
extension (deferred, only if you want maximal terseness): auto-detect adapter
type from file extension (`fasta: 'foo.fa.gz'` → infer `BgzipFastaAdapter`) —
implicit magic, do only if comfortable with that.

**Declarative JBrowse spec.** Current config is internal MST serialization. Extend
`session-spec` to a simpler data → encoding → mark grammar (Vega-Lite style). Infer
adapter/display types, map encoding → colorBy/filterBy, fall back to raw config for
advanced features. End users write clean schemas; plugin authors keep MST power.
(`readConfObject`/`getConf` are hot-path MST traversals — caching would help.)

**R/ggplot2 export** (branch exists). Export session as an R script using
ggplot2/Bioconductor for publication figures and reproducibility:
alignments→geom_rect, coverage→geom_area, variants→geom_point, synteny→geom_segment,
with Gviz/ggbio where applicable.

**Jupyter/Quarto integration.** Embed JBrowse in notebooks via a simple API
(`jbrowse.view()`). The spec layer would simplify wiring;
`@jbrowse/react-linear-genome-view` exists but config is too complex.
