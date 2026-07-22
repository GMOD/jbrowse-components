This example packages the view as a **custom element**. It mounts
`@jbrowse/react-linear-genome-view2` inside a Shadow DOM and registers the
result as `<jbrowse-linear-view>` with
[`@r2wc/react-to-web-component`](https://www.npmjs.com/package/@r2wc/react-to-web-component),
so a host page can drop in a genome browser with one HTML tag and no React of
its own:

```html
<jbrowse-linear-view></jbrowse-linear-view>
```

Shadow DOM is what makes that safe to hand out. Styles can't leak in from the
host page or out into it, which matters when you're embedding into a CMS, a
LIMS, or any page whose global CSS you don't control.

The component itself needs no special configuration. The one thing you must do
is give Material-UI's emotion cache and the MUI portal containers (menus,
tooltips, dialogs) a target **inside** the shadow root. Otherwise MUI appends
them to `document.body`, outside the shadow boundary, where the cache's styles
don't reach them and they render unstyled.

For composing with parent styles rather than isolating from them, see
[styling from outside](../theming/#with-outside-styling).
