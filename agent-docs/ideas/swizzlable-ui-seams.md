---
name: swizzlable-ui-seams
description: Six named UI seams is not a plugin API, it is six holes. Which parts of the app should get a name now that naming one costs a line, and the two gaps in the mechanism to settle first.
---

# Which UI should be swizzlable

A plugin can wrap or replace six components: the widget body, the About dialog
body, the add-track pane, the folder dialog and the two desktop start-screen
panels. It can add panels to two lists and elements to six overlays. Everything
else in the app is unreachable, and a plugin wanting it has no route at all —
not a worse route, none.

That count is not a design; it is what accumulated. The bad abstraction the old
`plugin-extension-points` entry described got fixed underneath it: replacing is
`wrapComponent` (wrapping and not rendering what you were handed, so two
plugins nest instead of one vanishing), scoping is one predicate every point
asks (`matchesTrackSelector`, including the one that renders nothing), and a
point
declares itself `ComponentSlot` / `ComponentList` / `ElementList` in one line.
Adding a seam now costs that line plus swapping `<Foo {...props}/>` for
`<PluggableComponent name="…" component={Foo} props={props}/>`.

**So the open question is a list, not a mechanism.** Candidates, roughly in
order of how often someone has wanted them:

- the track label and its menu button (`TrackLabel`)
- a display's own body, distinct from replacing the whole widget
- the LGV header and its search box
- the import form, per view type
- the hierarchical selector's row — `TrackSelector-trackRowAdornment` is a
  half-measure at this already, and accumulates a `TrackRowAdornment | undefined`
  rather than a component, so it is a fourth shape nobody else uses
- the drawer widget header

Two things to settle before naming any of them.

**A seam is an API, and its props are the contract.** `PluggableComponent`
hands the default's props straight through, so naming a seam publishes whatever
that component currently takes — including a whole MST model, whose every field
then becomes something a plugin may read and we may not move. The three shapes
type this but do not narrow it. A seam over a display probably wants a
hand-written props interface rather than the component's own.

**Replacing is still silent when it is deliberate.** A wrapper that ignores
`DefaultComponent` takes the slot with no warning, because
`evaluateComponentExtensionPoint` counts a `wrappedComponent` marker as
composition. Two plugins replacing the same seam is the case that used to warn
and now does not; the warning survives only for callbacks registered on the
point by hand. At six seams that is tolerable. At twenty it is a support
burden, and the fix is probably a render-time check that the default really
mounted, since nothing static can tell the two apart.

Prior art worth reading before picking: Docusaurus swizzling, which is the same
wrap/eject split resolved at build time by module aliasing rather than at
runtime by a registry, and which gates ejecting an unstable component behind a
`--danger` flag. The equivalent question here is whether a seam should be able
to declare itself unstable.
