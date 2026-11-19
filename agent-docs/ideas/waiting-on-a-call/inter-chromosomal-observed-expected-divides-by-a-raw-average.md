---
name: inter-chromosomal-observed-expected-divides-by-a-raw-average
description: Hi-C observed/expected between two chromosomes divides a normalized count by the pair's raw average, as straw and Juicebox do; for a file whose vectors average far above 1 (a cooler's weights copied by hictk) every inter-chromosomal cell would read near 0. The call is whether to depart from straw.
---

# Inter-chromosomal observed/expected divides by a raw average

Within a chromosome, `@gmod/hic`'s `getExpectedValues` reads the expected
vector of the normalization the pair got, so observed and expected are on one
scale. Between two chromosomes it returns
`{ kind: 'inter', average: sumCounts / nBins1 / nBins2 }`: the zoom level's raw
contact total spread over the pair's bins, whatever the normalization. The
worker (`executeRenderHicData.ts`) divides each normalized count by it.

straw computes the inter-chromosomal average the same way and applies it to
normalized counts too, so the plugin matches the reference reader. That is
harmless while a file's normalization vectors average about 1, which Juicer's
do (`test.hic`'s KR vectors' mean product is 0.978). A cooler's balancing
weights, which hictk copies into a `.hic` as `ICE`, balance rows to 1 and
average far above it; there a normalized count is far below its raw one, and
every inter-chromosomal cell would paint near 0 on the ratio ramp.

## The change

Scale the average by the pair's `contactsPerCount`, the product of the two
vectors' means, which `controlPair.ts` already computes for observed/control.
Under `NONE` it is 1, so raw observed/expected is unchanged.

## What decides it

- **The call**: whether observed/expected departs from straw's average on
  every file, for the sake of files whose vectors average far above 1.
- **The number to take first**: inter-chromosomal observed/expected on a
  hictk-converted cooler, before and after, to confirm the near-0 reading is
  real and the scaled one centres on 1.
