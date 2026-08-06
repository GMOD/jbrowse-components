Mounting the view inside a Shadow DOM and registering it with
[`@r2wc/react-to-web-component`](https://www.npmjs.com/package/@r2wc/react-to-web-component)
turns it into one HTML tag a host page can drop in with no React of its own:

```html
<jbrowse-linear-view></jbrowse-linear-view>
```

Shadow DOM is what makes that safe to hand out: styles can't leak in from the
host page or out into it, which matters in a CMS, a LIMS, or any page whose
global CSS you don't control.

The component needs no special configuration. The one thing you must do is point
Material UI's emotion cache **and** its portal containers (menus, tooltips,
dialogs) at a target inside the shadow root — otherwise MUI appends them to
`document.body`, outside the boundary, where the cache's styles don't reach and
they render unstyled.

To compose with parent styles rather than isolate from them, see
[styling from outside](../theming/#with-outside-styling).
