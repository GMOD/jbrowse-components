# Canvas Plugin

## Layout requirements

A single feature can span multiple discontiguous displayed regions on the same
reference sequence (e.g. a gene spanning chr1:1-300 when the view shows
chr1:1-100 and chr1:200-300 side by side). When this happens, the feature must
receive the same Y position in every region it appears in. This means regions on
the same reference sequence (same assemblyName + refName) must share a layout.
Regions on different reference sequences should use independent layouts so that
unrelated absolute bp coordinates do not cause false overlaps.
