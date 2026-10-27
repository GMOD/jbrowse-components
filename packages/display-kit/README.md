# @jbrowse/display-kit

The layer a track type is built on. Everything between a worker fetch and a
canvas that is not the pixels themselves: the two fetch foundations
(`MultiRegionDisplayMixin`, `GlobalFetchMixin`), the byte gate
(`RegionTooLargeMixin`), the display chrome (`DisplayChrome`), SVG export
(`renderDisplaySvg`), and the `RegionHost` contract that says what a display may
read off the view containing it.

The pixels are `@jbrowse/render-core`; the toolkit-free chrome contract is
`@jbrowse/display-ui`. This package depends on both and on `@jbrowse/core`, and
the linear genome view plugin depends on it, never the reverse.

There is no barrel. The `exports` map in `package.json` is the API, pinned by
`src/publicApi.test.ts`, and **@experimental**. A runtime plugin gets the host's
copy whatever it pins, so the version a plugin builds against fixes only its
types.

A subpath belongs in the map when an external display would import it: a
foundation or mixin, a chrome piece, a host contract, a config-schema fragment,
or a module whose types an exported declaration names. The foundations' own
machinery (their autoruns and phase selectors) stays unexported, since the host
serves every subpath to plugins (ADR-128).
