---
name: lazy-rpc-method-bodies
description: What is left of the eager RPC weight after the encoded-layer, plot-field and consensus bodies went behind preload(): `MafGetSequences`' body, `matedBy` inside featureTransforms, and wiggle's util pulling markEncoding for its constants.
---

# Lazy RPC method bodies

RPC method classes register at plugin install, so a body named at module scope
loads on every page. The encoded-layer, plot-field and consensus bodies now come
in on first use, as `RenderAlignmentData`'s does
(`plugins/alignments/src/RenderAlignmentDataRPC/`). Three imports remain;
measure each on a fresh build before moving it.

- Give `MafGetSequences` a `preload()` body; it names
  `processFeaturesToFasta` at module scope.
- Move `matedBy` out of `packages/core/src/util/featureTransforms.ts` into its
  own module, so a caller wanting only it stops pulling the transforms.
- Split `plugins/wiggle/src/util.ts` so its constants stop importing
  `markEncoding`.
