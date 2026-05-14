we are working on visualizing graph pangenome data on this branch in
plugins/graph. I want to be able to visualize linearized versions of the graph
showing insertions and deletions relative to a given "path" or walk through the
graph using MultiLGVSyntenyDisplay (e.g. the reference hg38 is just one path
through the graph pangenome). I also want to be able to load bandage-style 2-D
graph genome for selected sub-graphs around a region of interest using our
GraphGenomeView (our bandage-style graph genome viewer).

We started designing GfaTabixAdapter for making a file format that helps fetch
subgraph data efficiently using a statically tabix based format, but our
approach for this does NOT seem to be performing well.

It feels slow, it fetches too much data, and it is just very unclear if it is
really working. We have tests that compare against the output of other tools
though so we need to plan for next steps.

I think the next step that I would propose is to make an express.js server that
dynamically calls odgi or similar tool. This would take the place of
GfaTabixAdapter. Then we can use that to

You can look at code and docs here:

- ~/src/vendor/odgi (a toolkit for graph genome layout)
- ~/src/vendor/vg (graph toolkit)
- ~/src/vendor/pangyplot (which is a web based tool with an ideal whole genome
  overview of graph, which is good...we want to be able to show large scale
  features like whole chromosome overviews)
- ~/src/vendor/sequenceTubeMap (a visualization program that draws 'graph
  pangenomes' using a subway-style tube map. importantly, it has some server
  side code that we may want to reference)
- docs for extract selected loci in odgi
  https://odgi.readthedocs.io/en/latest/rst/tutorials/extract_selected_loci.html

Then we will try to (a) test our new adapter in the multilgvsyntenydisplay and
(b) test our new adapter in the GraphGenomeView

You can do whatever architectural changes that are needed to make this work

Create the minimal express.js server, based on the code in sequenceTubeMap or a
copy of it. It is mit licensed.

You can create simple standalone test scripts to test the server behavior and
puppeteer based tests to ensure the app is working

You can also add debug logging and timing information to ensure it is fast, and
get screenshots of the app in puppeteer for confirmation
