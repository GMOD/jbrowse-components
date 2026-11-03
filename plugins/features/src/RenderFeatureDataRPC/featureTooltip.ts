/**
 * `tooltip.field`'s default. `function` (the INSDC/GFF3 qualifier) comes
 * before the id fallback, so hovering a feature with no name, an NCBI viral
 * `stem_loop` say, shows its descriptor rather than a bare id; `get()`, since
 * `function` is reserved.
 */
export const DEFAULT_TOOLTIP = `jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')`
