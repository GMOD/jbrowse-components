// jsdom has no layout engine and doesn't define Element.prototype.scrollIntoView
// at all, so a component that scrolls itself into view on mount (ViewHeader,
// when a view is added to an already-rendered app) throws a TypeError rather
// than no-opping. There is nothing meaningful to report without layout, so a
// no-op is faithful.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
