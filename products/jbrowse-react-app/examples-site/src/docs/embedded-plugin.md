Plugins extend the app with new track types, adapters, renderers, view types and
menu items. The simplest form: define a `Plugin` subclass in your own source and
pass the class in `plugins`. An npm-published plugin looks identical — you
`import` the class and pass it the same way.

This one adds a "console.log the selected region" item to the linear genome
view's rubber-band menu; **click and drag on the ruler** to see it.

Plugins can also be [loaded from a URL](../plugins/#with-external-plugin) at
runtime. If you enable the
[web worker RPC](../customizing-the-app/#with-web-worker), a plugin has to be
registered in the worker as well as the main thread. Authoring:
[plugin development guide](https://jbrowse.org/jb2/docs/developer_guide/).
