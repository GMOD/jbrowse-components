`BreakpointSplitView` stacks two (or more) linear genome views and draws curves
between the breakpoints of split/translocated reads. `init.views` is an array of
`{ loc, assembly, tracks }`, one per stacked panel:

```js
{
  type: 'BreakpointSplitView',
  init: {
    views: [
      { loc: 'ctgA:1-5000', assembly: 'volvox', tracks: ['volvox_sv_cram'] },
      { loc: 'ctgB:1-5000', assembly: 'volvox', tracks: ['volvox_sv_cram'] },
    ],
  },
}
```

Like every view type, this is declared as a `defaultSession.views` entry (see
[Linear synteny view](../synteny-views/#synteny-example) for the general
pattern). The fields `init` accepts come from the
[BreakpointSplitView model docs](https://jbrowse.org/jb2/docs/models/breakpointsplitview/).
