# Arabidopsis methylation demo

A small slice of real *Arabidopsis thaliana* ONT 5mC/5hmC data for exercising
the methylation cytosine-context views (CpG / CHG / CHH / all).

- `arabidopsis_meth.bam` — 154 reads on chromosome 1 (`NC_003070.9`), the first
  ~50 kb, coordinate-sorted and indexed. Carries `MM`/`ML` modification tags.
- `arabidopsis_chr1.fa` — `NC_003070.9:1-50000`, renamed to the full chromosome
  name so read coordinates line up.
- `config.json` — opens zoomed into `NC_003070.9:2,000-5,000` in the CHH context.

## Source / attribution

Derived from the **ONT base-modification benchmark** dataset on the AWS Registry
of Open Data: `s3://ont-basemod-benchmark-data/` (file
`Analysis/modbam/plants/Arabidopsis/Arabidopsis_5kHz_sup_v4r1_5mC.bam`,
reference `Analysis/Reference/arabidopsis_thaliana.fa.gz`). Subset and
re-headered for testing.

https://registry.opendata.aws/ont_basemod_data/

For larger demos, host the full-size files remotely (e.g.
`https://jbrowse.org/demos/arabidopsis/`) and point the config at the URLs
rather than committing them here.
