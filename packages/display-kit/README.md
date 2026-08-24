# @jbrowse/display-kit

The layer a track type is built on, and `defineDisplay`, which builds one from a
spec: settings tagged with what they invalidate, a worker fetch, a painter, and
optionally a GPU pass. A third party calls that and composes nothing below.
Everything between a worker fetch and a canvas that is not the pixels
themselves: the two fetch foundations (`MultiRegionDisplayMixin`,
`GlobalFetchMixin`), the byte gate (`RegionTooLargeMixin`), the display chrome
(`DisplayChrome`), SVG export (`renderDisplaySvg`), and the `RegionHost`
contract that says what a display may read off the view containing it.

The pixels are `@jbrowse/render-core`; the toolkit-free chrome contract is
`@jbrowse/display-ui`. This package depends on both and on `@jbrowse/core`, and
the linear genome view plugin depends on it, never the reverse.

There is no barrel. The `exports` map in `package.json` is the API, pinned by
`src/publicApi.test.ts`, and **@experimental**: pin an exact version.
