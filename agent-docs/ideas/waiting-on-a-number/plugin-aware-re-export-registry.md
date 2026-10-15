---
name: plugin-aware-re-export-registry
description: A page naming a runtime plugin pays 322 KB gz over a bare one because the host serves the whole re-export registry. A UMD bundle carries literal JBrowseExports["@jbrowse/core/util"] strings, so the host could scan the plugin's text and load only the named modules, falling back to the whole registry on a non-literal access or jbrequire. A prototype has to measure the saving (up to about 307 KB) first; ADR-128 rejected a lazy registry on the premise the bundle does not carry what it reads.
---

# A plugin-aware re-export registry

[ADR-128](../../architecture-decision-records/adr-128-the-runtime-abi-is-the-exports-maps.md) rejected a lazy registry because
the bundle does not carry what it reads. Measured 2026-10-08 on the protein3d
bundle, a UMD bundle does carry the literal strings.

- **Idea:** scan the plugin's text for `JBrowseExports["<module>"]` and load
  only the named modules.
- **Fallback:** the whole registry on any non-literal access or `jbrequire`.
- **Ceiling:** up to about 307 KB gz on pages naming a runtime plugin.
- **First move:** prototype and measure.
- **Risk to check:** removing a served name fails quietly
  ([PLUGIN_ABI_STABILITY.md](../../reference/PLUGIN_ABI_STABILITY.md)); a scan
  that misses a computed access would break a published plugin that boots fine.
