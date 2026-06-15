 - no click and drag lgv scroll when on bookmark icon
 - make 'show proper pairs':false still show discordant pairs, not just abnormally long ones?
 - make small samplot show at least 1px wide?
 - make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
 - aggressively refactor plugins/alignments/src/LinearAlignmentsDisplay/renderers/GpuAlignmentsRenderer.ts
 - aggressively refactor generate-screenshots
storybook observe
view.dynamicBlocks describes the regions currently scrolled into view, updated on every pan and zoom. An observer reading it gets free reactivity:

Error: displays is not iterable
  at applySnapshotPreProcessor (/vendors-node_modules_pnpm_floating-ui_react_0_27_19_react-dom_19_2_7_react_19_2_7__react_19_2-a11d94.iframe.bundle.js:18205:38)
  at isValidSnapshot (/vendors-node_modules_pnpm_floating-ui_react_0_27_19_react-dom_19_2_7_react_19_2_7__react_19_2-a11d94.iframe.bundle.js:18219:31)
  at validate (/vendors-node_modules_pnpm_floating-ui_react_0_27_19_react-dom_19_2_7_react_19_2_7__react_19_2-a11d94.iframe.bundle.js:14993:29)
  at isValidSnapshot (/vendors-node_modules_pnpm_floating-ui_react_0_27_19_react-dom_19_2_7_react_19_2_7__react_19_2-a11d94.iframe.bundle.js:19057:30)
  at validate (/vendors-node_modules_pnpm_floating-ui_react_0_27_19_react-dom_19_2_7_react_19_2_7__react_19_2-a11d94.iframe.bundle.js:14993:29)
  at is (/vendors-node_modules_pnpm_floating-ui_react_0_27_19_react-dom_19_2_7_react_19_2_7__react_19_2-a11d94.iframe.bundle.js:15006:21)
  at ../../node_modules/.pnpm/ (jbrowse+mobx-state-tree@5.11.1_mobx@6.16.1/node_modules/@jbrowse/mobx-state-tree/dist/mobx-state-tree.mjs/determineType/<@/vendors-node_modules_pnpm_floating-ui_react_0_27_19_react-dom_19_2_7_react_19_2_7__react_19_2-a11d94.iframe.bundle.js:18805:50)
  at determineType (/vendors-node_modules_pnpm_floating-ui_react_0_27_19

  restore source code links to storybooks

"color" and "color by" on regular linearfeaturedisplay
thinner insertion triangles in multisample variant display when zoomed in
