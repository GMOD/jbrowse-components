An adapter answers one region at a time, so any server that takes a range can
feed a track. Ensembl names a chromosome `17` where the hg38 FASTA has `chr17`,
and the assembly's `refNameAliases` file maps them. A region over the server's
limit throws `regionTooLarge`, which the track shows without a retry button.
[Creating adapters](https://jbrowse.org/jb2/docs/developer_guides/creating_adapter/)
covers the full API.
