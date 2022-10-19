---
id: basechorddisplay
title: BaseChordDisplay
toplevel: true
---

#### slot: onChordClick
```js

    /**
     * !slot
     */
    onChordClick: {
      type: 'boolean',
      description:
        'callback that should be run when a chord in the track is clicked',
      defaultValue: false,
      contextVariable: ['feature', 'track', 'pluginManager'],
    }
```
