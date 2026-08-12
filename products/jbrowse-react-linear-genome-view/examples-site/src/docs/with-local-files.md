`localFiles` is `name -> bytes`, and a track then refers to that name as if it
were a URL. **It exists for hosts whose data lives in a process rather than at a
URL** — a Jupyter kernel, an R session, a desktop app. On an ordinary web page
you would serve the file; the reason to reach for this is that there is no
server to serve it from, and no CORS or public bucket to arrange.

The bytes become a `Blob`, which JBrowse reads **by byte range** through
`Blob.slice()`. So an indexed file stays indexed — a bgzipped+tabixed table, a
BAM with its `.bai`, a bigWig — and only the region on screen is ever touched.
That is what makes this the answer for a result too big to inline as features,
which the notebooks below measure.

Register an index under its conventional sibling name (`peaks.bed.gz` +
`peaks.bed.gz.tbi`). The adapter asks for it by that name, derived from the data
file's, so nothing on your side has to know which adapter wanted which file.

To add files to a view that is already up, rather than rebuilding it, use
`createLinearGenomeView`'s `addLocalFiles`.

## In a notebook

[`jbrowse-anywidget`](https://github.com/GMOD/jbrowse-anywidget) wraps this as
`add_local_file(path)`, which reads the file and its sibling index out of the
kernel:

- [Large results](https://github.com/GMOD/jbrowse-anywidget/blob/main/examples/12_large_data.ipynb)
  — every NCBI RefSeq exon in the human genome, as tabix rather than as JSON.
- [Large signal](https://github.com/GMOD/jbrowse-anywidget/blob/main/examples/13_large_wiggle.ipynb)
  — the same comparison for quantitative data, via bigWig.
