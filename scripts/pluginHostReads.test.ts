import { hostReads, unservedReads } from './pluginHostReads.ts'

const ENTRY = 'https://example.org/dist/plugin.esm.js'
const SHARED = 'https://example.org/dist/chunks/shared.js'
const DISPLAY = 'https://example.org/dist/chunks/display.js'

// esbuild's minified, code-split output: the shim and its __toESM wrapper live
// in one chunk and are imported under new one-letter names by the others.
const sources = new Map([
  [
    ENTRY,
    `import{a as r}from"./chunks/shared.js";
     var u=r(JBrowseExports["@jbrowse/core/Plugin"]),P=u.default;
     var{getSession:g,...rest}=JBrowseExports["@jbrowse/core/util"];
     export default class extends P{install(){import("./chunks/display.js")}}`,
  ],
  [
    SHARED,
    `var t=(e,o)=>()=>(o||e((o={exports:{}}).exports,o),o.exports);
     var n=(e,o)=>e;
     var c=t((e,o)=>{o.exports=JBrowseExports["@jbrowse/display-kit/DisplayChrome"]});
     var m=t((e,o)=>{o.exports=JBrowseExports["react"]});
     export{n as a,c as b,m as c}`,
  ],
  [
    DISPLAY,
    `import{a as e,b as s,c as i}from"./chunks/../shared.js";
     var a=e(s(),1),k=e(i(),1);
     function render(s){return s.notAHostRead+a.DisplayStatusChrome+k[s.key]}
     export{render as default,a as chrome}`,
  ],
])

test('reads follow a shim across chunks and stop at a shadowing local', () => {
  expect(hostReads(sources, ENTRY)).toEqual([
    '@jbrowse/core/Plugin#default',
    '@jbrowse/core/util#*',
    '@jbrowse/core/util#getSession',
    '@jbrowse/display-kit/DisplayChrome#DisplayStatusChrome',
    'react#*',
  ])
})

test('a removed name is unserved; default, * and a nameless framework module are not', () => {
  const manifest = {
    framework: { react: ['useState'], '@mui/material/Checkbox': [] },
    modules: {
      '@jbrowse/display-kit/DisplayChrome': { names: ['default'] },
      '@jbrowse/core/Plugin': { names: ['default'] },
      '@jbrowse/mobx-state-tree': { names: ['types'] },
    },
  }
  expect(
    unservedReads(
      [
        '@jbrowse/core/Plugin#default',
        '@jbrowse/display-kit/DisplayChrome#DisplayStatusChrome',
        '@jbrowse/display-kit/Gone#default',
        '@mui/material/Checkbox#anything',
        'mobx-state-tree#types',
        'mobx-state-tree#flow',
        'react#*',
        'react#useState',
      ],
      manifest,
    ),
  ).toEqual([
    '@jbrowse/display-kit/DisplayChrome#DisplayStatusChrome',
    '@jbrowse/display-kit/Gone#default',
    'mobx-state-tree#flow',
  ])
})
