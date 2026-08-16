---
id: display-ui
title: display-ui
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## DisplayUIProvider

Both bring-your-own seams at once: what a display draws that is not data.

There are two contexts underneath because two different things render them — the
chrome around a display draws the status states, the display itself draws its
bottom-right controls — and that split is real at the implementation level,
since `DisplayChromeBase` takes its overlay set as a _prop_ and never renders a
track control. It is not real for an embedder: nobody wants stock Material
loading scrims with plain corner controls, or the reverse. Every consumer in
this repo mounts the two together.

```tsx
<DisplayUIProvider>{tracks}</DisplayUIProvider>
```

Both props default to the plain, toolkit-free sets, so the common case — "I do
not want Material UI in my app" — needs no arguments and no second import.

**`overlays` is a partial set**, merged over the plain one, so replacing a
single state is one entry rather than five:

```tsx
<DisplayUIProvider overlays={{ ErrorBar: MyErrorBar }}>
```

Partial rather than whole for two reasons. A host writing four of the five
states by hand only ever wanted one of them, and every example of this had
spread `plainChromeOverlays` in to say so. And a _sixth_ state is a thing
JBrowse can add: with a whole set the host's object goes stale on upgrade — a
compile error if they typecheck, a missing component if they ship JS — while a
partial one keeps working and picks up the new plain default.

Declare that object at module scope if you can. The merge is stable per object
(`resolveOverlays`), so a constant costs one merge for the life of the app; a
literal written inline in JSX is a new object every render, and this value goes
into a context, so every display beneath re-renders with it.

**The contexts themselves still default to `undefined`, and that stays true.** A
display rendering outside any provider — a unit test, the SVG export,
breakpoint-split-view's `overlayUtils` — keeps JBrowse's own Material look,
because a plain ambient default would degrade those invisibly. Defaulting _this
component's props_ is a different thing: mounting it is a deliberate act, and
the act means "not the Material default". Nothing gets a plain set without
someone having asked.

Colors are not a seam and are not here. A display reads `usePalette()` for its
own content colors, which is a palette of strings rather than a UI toolkit, so
it arrives through `PaletteProvider` (`@jbrowse/core/ui/PaletteContext`)
whatever these are set to. A feature track needs it even with plain chrome.

This module reaches no `@mui/*` module, and `muiFree.test.ts` keeps it that way
— asking for less Material UI must not download more of it. What it cannot do is
unship the Material components a _stock display_ imports: `DisplayChrome` and
`TrackControl` are in that display's chunk either way, and merely stop
rendering. Keeping them out of the graph means writing your own display
component over `DisplayChromeBase`, which takes `overlays` as a prop and imports
no toolkit. See `agent-docs/reference/DISPLAYCHROME.md`.

```js
// type signature
({ overlays, trackControl, children, }: { overlays?: Partial<…> | undefined; trackControl?: TrackControlComponent | undefined; children: ReactNode; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/DisplayUIProvider.tsx)

## isLiveModel

Whether an overlay's model can still be called into.

The terminal states unmount the canvas, so a click landing after the track was
closed would otherwise run an action on a destroyed node — which is why both
overlay sets guard their one button with `isAlive`.

**`isAlive` alone is wrong here, and it throws rather than answering.** The four
model shapes in `chromeOverlays.ts` are structural on purpose ("A display
satisfies one by having the fields; no mixin has to be composed"), so a host
writing their own display over `DisplayChromeBase` may hand these components a
plain object. `isAlive` runs `assertIsStateTreeNode` and throws on one, inside
an event handler, where React logs it and moves on — leaving the Force load
button looking live and doing nothing, which is the exact state
`DisplayChromeOverlays.TooLarge` documents itself as existing to prevent.

A plain object is never destroyed, so it is always callable. The liveness
question only exists for an MST node.

```js
// type signature
(model: unknown) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/isLiveModel.ts)

## plainChromeOverlays

The five `displayPhase` states drawn with no UI toolkit: no theme provider to
mount, no emotion in the host page, and nothing that reads as a stray Material
widget inside someone else's design system.

`DisplayUIProvider` installs this by default, so mount that rather than naming
this — reach for it directly only to wrap a state or to build a context value by
hand. Colours come from `currentColor` and the CSS system colours, so the host's
own cascade drives them in both light and dark.

The `data-testid` values it renders are a contract four of JBrowse's test
systems key on, so a replacement set that keeps them can be driven by those
suites too.

```js
// type signature
DisplayChromeOverlays
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/plainChromeOverlays.tsx)

## PlainTrackControl

A display's ambient bottom-right control — track sizing, the isoform notice, the
show-only badge — drawn with no UI toolkit, the corner-control counterpart of
`plainChromeOverlays`.

`DisplayUIProvider` installs this by default. The behaviour is not in here:
dismissal, the keyboard, focus, the top layer and the anchoring are
`useTrackControlMenu`, so writing your own control means writing markup rather
than re-deriving why the menu opens upward.

The package exports it as `plainTrackControl`, lower-cased to match
`plainChromeOverlays` — the two are a pair, and both are things you hand to a
provider rather than render yourself.

```js
// type signature
({ icon, tooltip, label, options, onClick, onDelete, warning, }: TrackControlProps) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/trackControl/plainTrackControl.tsx)

## tooLargeBannerText

Which axis tripped (empty when the display gates without a reason), then the way
out.

`zoomCanRelease` decides whether "zoom in" is offered, and it has to be asked
because the advice is not always true. It was, once: the `AUTO_FORCE_LOAD_BP`
floor turned the byte gate off below 20kb, so zooming far enough always worked.
The byte gate no longer stops at any floor, and an index quotes whole blocks —
so for a file whose blocks are large the same bytes come down however far the
user goes, and telling them to keep zooming into a fetch whose cost cannot fall
is the one thing the banner must not do. `zoomCanReleaseGate` answers it from
two consecutive measurements rather than from a threshold; see
`ByteEstimate.zoomIneffective`.

```js
// type signature
(regionTooLargeReason: string, { zoomCanRelease }?: { zoomCanRelease?: boolean | undefined; }) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/tooLargeBannerText.ts)

## TrackOverlayPortal

Lift floating track chrome out of the display's `contain: strict` sandbox and
into the host's overlay node, so the LGV's inter-region masks cannot bury it at
multi-region scale. `TrackOverlaySlot` is the other end.

The overlay node takes no pointer events, so anything of yours the user hovers
or clicks sets `pointer-events: auto` on its own positioned box.

With no slot above it this renders the children in place (`fallbackInline`, the
default), which preserves chrome that is still meaningful unescaped. Pass
`fallbackInline={false}` for chrome that only makes sense above the masks and
draws itself some other way elsewhere.

```js
// type signature
({ children, fallbackInline, }: { children: ReactNode; fallbackInline?: boolean | undefined; }) => ReactNode
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/trackOverlay/TrackOverlayPortal.tsx)

## TrackOverlaySlot

The box a display is mounted in, plus the overlay node its floating chrome
escapes into. Pair to `TrackOverlayPortal`, which is the other end.

A display's React tree is sealed in a `contain: strict` sandbox — that is what
isolates its paint, and dropping it is measured and rejected (ADR-058). A
stacking context comes with the isolation, so floating chrome a display draws (a
colour key, hi-c's overlay panel, maf's row labels) cannot out-z-index anything
painted over the track stack from outside. The escape is a node mounted _beside_
the sandbox rather than inside it, published through `TrackOverlayContext`; this
component is that node, its context and the paint order between them, in the one
place they have to agree.

`TrackContainer` uses it, so JBrowse's own layout and an embedder's go through
the same code rather than two copies of one rule. **An embedder mounting
`RenderingComponent` directly needs it too**, and that is the case it was added
for: with no provider the context is null, the portal falls back to rendering
inline, and a host that paints region seams over its column buries the chrome
under them with nothing to say so.

```tsx
<TrackOverlaySlot zIndex={3} style={{ height: display.height }}>
  <div style={{ position: 'absolute', inset: 0, contain: 'strict' }}>
    <RenderingComponent model={display} />
  </div>
</TrackOverlaySlot>
```

**`zIndex` is required, and deliberately has no default.** It is the answer to
"above what?", and that is a fact about the caller's layout rather than about
this component: JBrowse's own track container passes 100, which is positioned
above `PaddingBlocks` and below `TrackLabel` at 200, and means nothing to a host
whose masks sit at 2. A default would be a number that is right in one layout
and silently wrong in every other, and the failure — chrome painted under a mask
— is invisible until someone looks at the right zoom.

The node takes no pointer events, so it does not eat the canvas's. Chrome that
wants them takes them back on its own positioned box; it also carries
`data-gesture-owner`, so anything that does is already exempt from the LGV's
click-drag pan.

```js
// type signature
({ children, zIndex, style, overlayStyle, }: { children: ReactNode; zIndex: number; style?: CSSProperties | undefined; overlayStyle?: CSSProperties | undefined; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/trackOverlay/TrackOverlaySlot.tsx)

## useTrackControlMenu

The behaviour behind a bottom-right track control's menu, as prop getters to
spread — dismissal (Escape, an outside press, an ancestor scrolling), the
keyboard (arrows, Home/End), focus, and the anchoring that clears both the
display's `contain: strict` box and the window edge.

For writing your own control rather than restyling `plainTrackControl`: each of
those rules is a bug when missed and none of them shows up in a screenshot.
Render `menuProps` only while `open`, and portal it to `document.body` —
`createPortal` is the caller's to aim, the maths is here. `menuProps.style`
carries position only.

```js
// type signature
;() => TrackControlMenu
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/trackControl/useTrackControlMenu.tsx)
