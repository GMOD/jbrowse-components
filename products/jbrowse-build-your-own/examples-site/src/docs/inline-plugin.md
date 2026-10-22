An adapter answers one region at a time, so any server that takes a range can
feed a track. Ensembl names a chromosome `17` and the hg38 FASTA names it
`chr17`. `getRefNames` returns Ensembl's names, and JBrowse maps between the two
through the assembly's `refNameAliases` file. A region over the server's limit
throws an error marked `regionTooLarge`, which the track shows without a retry
button. The full adapter API is in
[Creating adapters](https://jbrowse.org/jb2/docs/developer_guides/creating_adapter/).
