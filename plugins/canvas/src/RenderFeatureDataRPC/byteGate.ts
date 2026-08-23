// The byte stage of every gated feature fetch now lives in core, beside
// `overByteBudget` and the refusal marker, because seven RPCs across five
// plugins run it as their first await. Re-exported here so this plugin's two
// executors keep one import path.
export { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
