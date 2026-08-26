---
name: two-spellings-of-how-tall-is-the-embed
description: the LGV takes a `height` prop and react-app2 takes a `--jbrowse-app-height` CSS variable, and both are deliberate — so unifying them is an API question with no commitment either way, and one of its two answers is a documented split rather than a change
---

# Two spellings of "how tall is the embed"

Moved out of [TODO.md](../TODO.md) on 2026-08-26. The issue behind it is
answered and shipped; what is left is a question about the published API that
nobody has taken a position on, and one of its answers is a sentence in the
docs.

`@jbrowse/react-linear-genome-view2` takes `height` — any CSS height, applied to
the component's own root — and a bounded view pins its chrome and scrolls only
its tracks, which is what [#4526](https://github.com/GMOD/jbrowse-components/issues/4526)
was actually asking for. `drawerViewHeight` is deprecated behind it, honored only
when `height` is absent. `effectiveHeight` on the root model is the one
definition of "bounded"; the session's `stickyViewHeaders` reads it, and from
there the existing web mechanism does the rest.

What is open is that the embedded products still answer the same question two
ways:

- **LGV**: `height`, a prop.
- **react-app2**: `--jbrowse-app-height`, a CSS custom property set on any
  ancestor, feeding `height: var(--jbrowse-app-height, 100vh)` on the App root
  (`app-core/ui/App/App.tsx`). Deliberate and documented — it has its own
  `fit-to-container` examples page — and it propagates height on purpose:
  `ScopedCssBaseline sx={{ height: '100%' }}`, which the LGV's does not.

So: does `height` become the one spelling, setting the variable on react-app2
rather than a style, since the variable is what App reads and hosts already use
it? Or is a prop for a component and a variable for an app the right split, in
which case say so somewhere a host reads. The circular product needs neither
until it has something to scroll: no drawer (`ModalWidget` is its only widget
surface), so nothing bounds it and nothing clips.

**`drawerViewHeight` stays** — published API, and `height` wins when both are
given.

**A correction worth keeping, because it cost a wrong answer to an issue.** An
earlier revision of this entry said sticky headers in the embedded session "are
not wanted", and that was read off the LGV getter's own comment — a session with
no such notion "should read as don't pin" — which describes what an absent
property *does*, not what anyone decided. It was wrong, and it nearly closed
#4526 with the opposite of the requested behavior. The sticky machinery was
already complete in the LGV component (`LinearGenomeViewContainer.tsx` pins the
header, `rubberbandTop` offsets the overlays); the embedded session simply never
opted in.

Unpinned in every product: the *unbounded* path's real layout. The host box works
because the chain of `height: 100%` stops at the MUI `ScopedCssBaseline` the
component mounts inside, which has no height — 400 / 400 / 692 / 692 / 692 down
the chain from a 400px box — and jsdom computes no layout, so pinning that needs
a browser test against an examples site rather than a jest one. Less urgent than
it was: a host that wants a bound now asks for one in a way jsdom can check, and
the unbounded path is the one that cannot pin its headers anyway.
