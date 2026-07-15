`@jbrowse/react-linear-genome-view2` can be mounted inside a Shadow DOM — useful
when embedding into a host page that has its own conflicting global styles, or
when packaging the view as a custom element.

The component itself needs no special configuration; this example renders it
inside a shadow root via React's portal mechanism. The key is giving
Material-UI's emotion cache and the MUI portal containers (menus, tooltips,
dialogs) a target **inside** the shadow root, so their styles stay scoped there
and host-page styles can't leak in.

For the simpler case of composing with — rather than isolating from — parent
styles, see [styling from outside](../with-outside-styling/).
