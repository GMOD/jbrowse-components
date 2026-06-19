A Nextstrain-style view of SARS-CoV-2, built entirely from **inline** data — the
assembly, tracks, and default session come from a single config object bundled
with the app rather than fetched from a server. This is the pattern for
self-contained embeds of small genomes (viruses, plasmids, organelles) where you
want zero external data dependencies.

Because the whole config is a plain JS object, it can be imported, generated, or
templated by your own code. See [default session](../default-session/) for the
session structure and
[the config guide](https://jbrowse.org/jb2/docs/config_guide) for the
track/assembly shapes.
