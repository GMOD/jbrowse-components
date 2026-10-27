# @jbrowse/plugin-data-management

The track selector, the add-track and add-connection widgets, the UCSC and JB2
track hub connections, and the assembly manager dialog.

- **Required:** web, desktop, react-app and the embedded LGV and CGV all install
  it. Each view opens its track selector as `HierarchicalTrackSelectorWidget`,
  and product-core's File menu opens `AddTrackWidget` and `AddConnectionWidget`,
  all by widget type name, so those clicks throw without this plugin.
- **Custom track selector:** wrap `Core-replaceWidget` and render your own body
  when `matchesTrackSelector` finds the widget type
  `HierarchicalTrackSelectorWidget`. The selector's model and heading stay this
  plugin's.
- **Extending add-track:** `pluginManager.addAddTrackWorkflowType` adds a
  workflow; the multi-row wiggle, MAF and graph plugins use it.
