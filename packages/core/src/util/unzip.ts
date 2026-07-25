// Deliberately its own entry rather than a name on the util barrel:
// @gmod/bgzf-filehandle declares no `sideEffects`, so webpack cannot tree-shake
// a re-export of it out of the barrel, and the barrel has ~1090 importers —
// including eager plugin entries. Re-exporting `unzip` there put bgzf + pako
// (~180KB) on the startup path of every page load.
export { unzip } from '@gmod/bgzf-filehandle'
