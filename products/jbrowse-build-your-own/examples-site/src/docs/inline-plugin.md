An adapter answers one region at a time, so any file a page can fetch can feed a
track. This one fetches a JSON list of GENCODE's chr17 genes once and filters it
per region. GENCODE says `chr17` where the hg38 FASTA says `17`, and the
assembly's `refNameAliases` maps them.
[Creating adapters](https://jbrowse.org/jb2/docs/developer_guides/creating_adapter/)
covers the full API.
