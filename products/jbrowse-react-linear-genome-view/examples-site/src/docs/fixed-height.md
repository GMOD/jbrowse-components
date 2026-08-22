`height` takes any CSS height and bounds the component itself. Without it the
view draws at content height and the page grows as tracks are added — right for
a document, wrong for a panel.

A host box with a height of its own still works and still bounds the view: the
chain of `height: 100%` from the component's outer div stops at the MUI
`ScopedCssBaseline` it mounts inside, which has no height, so everything below
lays out at content height within your box and your box scrolls. The difference
is which element scrolls, and that the prop says what the box only implies.

What scrolling costs you either way is the ruler: the header, the overview
scalebar and the coordinates leave the top of the box along with the first
track. Pinning them is a session preference the web app has and the embedded
session deliberately does not, and the view reads that absence as "don't pin" —
so size for the tracks you mean to show if the ruler has to stay in view.

`drawerViewHeight` is the older spelling of this prop, applying only while a
drawer widget is open — it existed because a drawer needs the view beside it to
be tall against something, and there was no height that always was. Pass
`height` instead; it is honored only when `height` is absent.
