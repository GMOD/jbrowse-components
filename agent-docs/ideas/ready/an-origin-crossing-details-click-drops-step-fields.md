---
name: an-origin-crossing-details-click-drops-step-fields
description: "A mark display's details click on a feature cut at a circular origin returns the adapter's whole record in place of the stepped row, so any field a layer step computed is gone from the details panel."
---

# An origin-crossing details click drops step fields

`executeGetEncodedFeature` in
[`executeEncodedLayers.ts`](../../../packages/core/src/rpc/methods/executeEncodedLayers.ts)
runs the clicked layer's steps, takes the row behind `featureIndex`, then asks
`recordAcrossOrigin` for the whole record and returns
`read?.crossingOrigin ?? row`. Where the feature crosses a circular origin,
`crossingOrigin` is the adapter's record, read past the steps, so the fields a
step computed on the row are not on what the panel shows. Read, not run.

## The fix

- Return the whole record's span and subfeatures with the row's own fields
  laid over them, and pin it with a test whose step adds a field to a feature
  cut at an origin.

The lookup is also one more adapter read per click on every sequence, since
nothing on a row says its sequence is circular. That cost belongs to the click
timing in
[waiting-on-a-number/feature-details-rerun-a-regions-steps.md](../waiting-on-a-number/feature-details-rerun-a-regions-steps.md).
