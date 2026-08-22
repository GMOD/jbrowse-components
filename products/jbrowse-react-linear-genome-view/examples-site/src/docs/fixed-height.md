`height` takes any CSS height and bounds the component itself — all of it, so a
`menuBar` row comes out of the total and the view takes the rest. Without it the
view draws at content height and the page grows as tracks are added — right for
a document, wrong for a panel.

Bounded, the view keeps its chrome in place and scrolls only the tracks: the
title bar, the navigation bar, the overview scalebar and the coordinate ruler
pin to the top of the box, the way JBrowse Web pins them and the way JBrowse 1
always did. Put the track selector in a drawer on the left and that is the whole
JBrowse 1 arrangement — sidebar, header, scrolling tracks.

A host box with a height of its own still bounds the view, and this is where it
differs: the box scrolls the whole component, chrome included, so the ruler
leaves the top along with the first track and no CSS you write outside can pin
it. The prop is what puts the scroll region _inside_ the view, which is what
gives the header something to stay behind.

`drawerViewHeight` is the older spelling of the prop, applying only while a
drawer widget is open — it existed because a drawer needs the view beside it to
be tall against something, and there was no height that always was. It bounds
the view the same way while it applies, headers pinned and all. Pass `height`
instead; `drawerViewHeight` is honored only when `height` is absent.
