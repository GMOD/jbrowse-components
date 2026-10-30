An adapter answers one region at a time, so any file or server that a page can
fetch can feed a track. This one fetches a JSON list of GENCODE genes on chr17
once and filters it per region; `scripts/build_inline_plugin_genes.sh` builds
the file. GENCODE names a chromosome `chr17` where the hg38 FASTA has `17`, and
the assembly's `refNameAliases` file maps them.
[Creating adapters](https://jbrowse.org/jb2/docs/developer_guides/creating_adapter/)
covers the full API.
