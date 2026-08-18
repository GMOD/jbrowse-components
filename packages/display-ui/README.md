# @jbrowse/display-ui

The UI a display draws that is **not data** — loading scrims, error bars, the
too-large gate, the controls in a track's corner, and the overlay layer floating
chrome escapes into. The contract, and implementations of it that reach no UI
toolkit.

```tsx
import { DisplayUIProvider } from '@jbrowse/display-ui'

;<DisplayUIProvider>{tracks}</DisplayUIProvider>
```

That is the whole common case: JBrowse's own stock displays render no Material
UI beneath it, with no `ThemeProvider` to mount and no emotion in your page.
Supply `overlays` (a partial set, merged over the plain one) or `trackControl`
to bring your own.

## Why it is a package

**This package has no UI-toolkit dependency, and that is the feature.** The
contract used to live beside the Material implementations it exists to replace,
so importing the seam pulled 45 `@mui/*` modules in behind it — the whole
Material overlay set, and (through one barrel import) `FileSelector`,
`FatalErrorDialog` and `PluginManager`. Every check in the repo counted
_rendered_ elements and stayed green. Here, npm decides instead of a test: the
Material bindings live in `@jbrowse/plugin-linear-genome-view`, which depends on
this, never the other way round.

It also puts the contract somewhere `packages/*` can reach. `tree-sidebar`
depended on the LGV **plugin** for `TrackOverlayPortal` alone; the comparative
displays could not read the overlay contract at all, because it sat one layer
above them.

## What is here

|                                             |                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `DisplayChromeOverlays`                     | the five `displayPhase` states, as a component set, with the model shape each is handed |
| `DisplayChromeOverlayProvider`              | redirects those states for JBrowse's own displays                                       |
| `TrackControlComponent`                     | one shape for every ambient bottom-right control, icons named rather than passed        |
| `TrackControlProvider`                      | redirects those                                                                         |
| `DisplayUIProvider`                         | both at once, defaulting to the plain sets — what an embedder mounts                    |
| `plainChromeOverlays` / `plainTrackControl` | the toolkit-free sets, CSS system colours, no theme object                              |
| `TrackOverlaySlot` / `TrackOverlayPortal`   | the per-track overlay layer, and the host's half of it                                  |
| `FloatingLegend`                            | the one legend box every display with colours to explain draws                          |
| `BottomRightCornerContext`                  | the corner `BackgroundProgress` is laid out in, which its prop types cannot express     |
| `tooLargeBannerText`                        | what the byte gate says, shared by every set that renders it                            |
| `isLiveModel`                               | the liveness guard an overlay's one button needs, for an MST node or a plain object     |

## What is _not_ here, and cannot be

Redirecting what a stock display **renders** is not the same as keeping a
toolkit out of its **bundle**. `DisplayChrome` and `TrackControl` live in the
LGV plugin and import Material UI; a provider only stops them rendering it.
Dropping the weight means writing your own display component over
`DisplayChromeBase`, which takes `overlays` as a prop.

See `agent-docs/reference/DISPLAYCHROME.md` for the seams in full, and
`products/jbrowse-build-your-own` for a site built on them.

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### BottomRightCornerContext

The one box per display that owns the bottom-right corner.

It lives beside the overlay contract rather than with the chrome that mounts it,
because it is the half of that contract the types cannot carry:
`DisplayChromeOverlays.BackgroundProgress` is the one state told to render an
in-flow chip with no `position` and no corner offsets, and this is the box it is
laid out in. A host writing their own display over `DisplayChromeBase` needs to
be able to build that corner; while this sat one layer up in the LGV plugin, the
rule was a paragraph they could only obey by hand.

Two independent things want that corner and neither could see the other: the
display's own control row (`BottomRightIndicators` — track sizing, the isoform
notice, the solo chip) and the chrome's background-progress chip
(`DisplayChromeOverlays.BackgroundProgress`, the status channel for work with no
fetch behind it). Both portal into the _same_ per-track overlay node, and both
used to claim `bottom: 2; right: 2` there with their own `position: absolute`
box — so they simply drew on top of each other, the controls winning on z-index
and the status text disappearing under them.

It has never been reachable: the two displays that render the control row
(alignments, canvas) are not among the four that report a `ready`-phase status
(clustering, on multi-wiggle / multi-row features / maf / the multi-sample
variant pair). That is the _reason_ to make it structural rather than to leave
it — nothing on either side is aware of the constraint, so the first display to
want both would find the bug, and it presents as a status message that silently
never appears.

`BottomRightIndicators` already described itself as "the single anchor point for
every bottom-right overlay ... so they lay out as one row instead of each
picking their own position and colliding". This makes that true of the chip too:
the chrome renders the anchor, puts its chip in it, and publishes the node here
so the display's row — rendered several components away, inside the chrome's
body — lands in the same flex box instead of over it.

`null` outside a chrome (a display an embedder mounts standalone, a unit test,
the SVG export), where `BottomRightIndicators` keeps its own anchored box. That
fallback is why this can be added without every consumer changing.

```js
// type signature
Context<HTMLElement | null>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/bottomRightCorner.ts)

### DisplayUIProvider

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
it arrives through `SessionPaletteProvider` (`@jbrowse/core/ui/PaletteContext`)
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

### isLiveModel

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

### plainChromeOverlays

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

### PlainTrackControl

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

### tooLargeBannerText

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

### Tooltip

A hover/focus label for a control, drawn rather than delegated to the browser's
`title` attribute — positioned so it clears the display's `contain: strict` box
and the window edge, dismissed by Escape, and drawn like every other JBrowse
tooltip instead of like whatever the host OS renders.

`title` is what this chrome used to use, and it was the wrong tool three ways:
it can be neither styled nor positioned, it waits about a second and then
disappears on a timer of its own, and on a control that already carries an
`aria-label` some screen readers announce both strings. This reaches no UI
toolkit, so the package's no-Material-UI guarantee holds.

Takes a single element child and clones it rather than wrapping it: the controls
that want a tooltip are absolutely positioned inside a legend or sit in a flex
row, where an extra `<span>` moves them. The child keeps its own handlers —
these compose on top of them.

```tsx
<Tooltip title="Hide legend">
  <button type="button" aria-label="Hide legend" onClick={onDismiss}>
    ×
  </button>
</Tooltip>
```

**The child still needs its own accessible name**, because this sets
`aria-describedby` and never `aria-label` — see useTooltip, which is this
without the cloning, for a host writing its own markup.

```js
// type signature
({ title, placement, children, }: { title: ReactNode; placement?: TooltipPlacement | undefined; children: ReactElement<…>; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/tooltip/Tooltip.tsx)

### TrackOverlayPortal

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

### TrackOverlaySlot

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

### useTooltip

A hover/focus label for one control, as props to spread — the headless half of
Tooltip, for a host writing its own chrome rather than restyling ours. Same
relationship `useTrackControlMenu` has to `plainTrackControl`.

```tsx
const { triggerProps, tooltip } = useTooltip('Hide legend')
return (
  <>
    <button {...triggerProps} aria-label="Hide legend" onClick={onDismiss}>
      ×
    </button>
    {tooltip}
  </>
)
```

`triggerProps` carries no `onClick`, so a control's own handler does not collide
with it. Any other handler on this list has to compose rather than replace —
spread first, then call `triggerProps.onFocus` from yours.

```js
// type signature
(title: ReactNode, { placement }?: { placement?: TooltipPlacement | undefined; }) => TooltipTrigger
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-ui/src/tooltip/useTooltip.tsx)

### useTrackControlMenu

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

<!-- API_DOCS_END -->
