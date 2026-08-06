Plugins extend the view with new track types, adapters, renderers, view types
and menu items. The simplest form: define a `Plugin` subclass in your own source
and pass the class in `plugins`. An npm-installed plugin looks identical — you
`import` the class and pass it the same way.

Plugins can also be [loaded from a URL](../plugins/#with-external-plugin) at
runtime. If you enable the [web worker RPC](../plugins/#with-web-worker), a
plugin has to be registered in the worker as well as the main thread. Authoring
is covered in the
[plugin development guide](https://jbrowse.org/jb2/docs/developer_guide/).
