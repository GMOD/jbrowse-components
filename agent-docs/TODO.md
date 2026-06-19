- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- aggressively refactor generate-screenshots
- group by strand plugins/canvas

## Coloring

Swap order in colo829


## links for color by strand, PUR



## vendor electron-updater


## Fused abortsignal+stoptoken?

## generate-screenshots stability

example instable screenshots, there may be others


modified:   static/img/about_track.png
	modified:   static/img/alignments/group_by_strand.png
	modified:   static/img/alignments_center_line.png
	modified:   static/img/sv_cgiab/translocation_sv_inspector_start.png

# website

collapsible sections in autogen


## plugin versions


switched to URL-derived version and it's all green (core typecheck clean, 22 tests pass incl.
  5 new installedVersionFromUrl cases, eslint clean). The button/tooltip now read the installed
  version from the store-minted URL, not plugin.version.

  Now, your point about enhancing jbrowse-plugin-list instead — important distinction worth getting
  right:

  The producer can't actually help here, because the missing fact isn't an available-version fact —
  it's an installed-version fact. The manifest already gives you available versions as structured data
  (versions[].pluginVersion). What we need to know is which version this particular user already has
  in their saved config. The producer has no idea what any given user installed — that's per-user
  state living only in their config. So no amount of enhancing the plugin-list changes where the
  installed version comes from.

  There are really only two places the installed version can come from:

  - The install URL in the config (what I just implemented). Zero migration, works for every existing
  install today. Only assumption: the URL keeps the …/<packageName>/<version>/… shape your producer
  mints. Reliable as long as that convention holds.
  (versions[].pluginVersion). What we need to know is which version this particular user already has in their saved config. The producer has no idea what any given user installed — that's per-user state
  living only in their config. So no amount of enhancing the plugin-list changes where the installed version comes from.

  There are really only two places the installed version can come from:

  - The install URL in the config (what I just implemented). Zero migration, works for every existing install today. Only assumption: the URL keeps the …/<packageName>/<version>/… shape your producer
  mints. Reliable as long as that convention holds.
  - A version field written into the config at install time — the structured alternative. This is consumer-side, not producer-side: PluginCard already has resolved.pluginVersion in hand when it installs,
  so it could persist {...definition, pluginVersion} into the config. Then you read it straight back, no URL parsing, no convention dependency. This is the minimal slice of the "identity-in-config" idea —
  just one extra field, not a full redesign.

  The nice part: these compose. The robust end state is prefer the stored pluginVersion, fall back to URL-parsing — new installs get the clean structured value, and already-installed plugins (which predate
  the field) still work via the URL. The URL parser I wrote becomes the back-compat path rather than the primary one.

  So I'd keep the URL approach as-is (it's the back-compat floor you need regardless), and optionally layer the install-time pluginVersion field on top when you want to stop depending on the URL
  convention. Want me to add that install-time field now, or leave it at the URL approach and commit what's here?
