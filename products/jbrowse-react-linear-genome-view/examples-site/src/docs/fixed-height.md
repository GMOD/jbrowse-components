The component has no height prop. It draws at content height and the page grows
as tracks are added — right for a document, wrong for a panel.

A host box with a height of its own is the answer today, and it does work: drag
the corner of this one and the view stays inside it while the tracks scroll. It
works because the chain of `height: 100%` from the component's outer div stops
at the MUI `ScopedCssBaseline` it mounts inside, which has no height, so
everything below lays out at content height within your box.

What scrolling costs you is the ruler: the header, the overview scalebar and the
coordinates leave the top of the box along with the first track. Pinning them is
a session preference the web app has and the embedded session deliberately does
not, and the view reads that absence as "don't pin" — so size the box for the
tracks you mean to show if the ruler has to stay in view.

`drawerViewHeight` is the one height the component sets itself, and it is not
this one: it applies only while a drawer widget is open, and the element it
clamps is `overflow: hidden`, so a taller track set is cut off rather than
scrolled.
