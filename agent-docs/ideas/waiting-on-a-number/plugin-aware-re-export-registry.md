---
name: plugin-aware-re-export-registry
description: A page naming a runtime plugin loads the whole re-export registry, though a UMD bundle names the `JBrowseExports` modules it reads, which undercuts ADR-128's premise for rejecting a lazy registry. Waits on a prototype measuring the saving.
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
