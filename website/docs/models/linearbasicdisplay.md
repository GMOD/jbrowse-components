---
id: linearbasicdisplay
title: LinearBasicDisplay
toplevel: true
---


used by `FeatureTrack`, has simple settings like "show/hide feature labels", etc.
#### property: type


```js

        /**
         * !property
         */
        type: types.literal('LinearBasicDisplay')
```
#### property: trackShowLabels


```js

        /**
         * !property
         */
        trackShowLabels: types.maybe(types.boolean)
```
#### property: trackShowDescriptions


```js

        /**
         * !property
         */
        trackShowDescriptions: types.maybe(types.boolean)
```
#### property: trackDisplayMode


```js

        /**
         * !property
         */
        trackDisplayMode: types.maybe(types.string)
```
#### property: trackMaxHeight


```js

        /**
         * !property
         */
        trackMaxHeight: types.maybe(types.number)
```
#### property: configuration


```js

        /**
         * !property
         */
        configuration: ConfigurationReference(configSchema)
```
#### getter: rendererTypeName



```js
// Type
any
```
#### getter: showLabels



```js
// Type
any
```
#### property: trackShowLabels


```js
 self.trackShowLabels
```
#### getter: showDescriptions



```js
// Type
any
```
#### property: trackShowDescriptions


```js

          self.trackShowDescriptions
```
#### getter: maxHeight



```js
// Type
any
```
#### property: trackMaxHeight


```js
 self.trackMaxHeight
```
#### getter: displayMode



```js
// Type
any
```
#### property: trackDisplayMode


```js

          self.trackDisplayMode
```
#### getter: rendererConfig



```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```
#### getter: rendererType


the pluggable element type object for this display's
renderer
```js
// Type
RendererType
```
#### getter: showLabels



```js
// Type
any
```
#### getter: showDescriptions



```js
// Type
any
```
#### getter: displayMode



```js
// Type
any
```
#### getter: maxHeight



```js
// Type
any
```
#### action: toggleShowLabels



```js
// Type signature
toggleShowLabels: () => void
```
#### property: trackShowLabels


```js

        self.trackShowLabels
```
#### getter: showLabels



```js
// Type
any
```
#### action: toggleShowDescriptions



```js
// Type signature
toggleShowDescriptions: () => void
```
#### property: trackShowDescriptions


```js

        self.trackShowDescriptions
```
#### getter: showDescriptions



```js
// Type
any
```
#### action: setDisplayMode



```js
// Type signature
setDisplayMode: (val: string) => void
```
#### property: trackDisplayMode


```js

        self.trackDisplayMode
```
#### action: setMaxHeight



```js
// Type signature
setMaxHeight: (val: number) => void
```
#### property: trackMaxHeight


```js

        self.trackMaxHeight
```
#### method: renderProps

```js
// Type signature
renderProps: () => { config: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>; }
```
#### getter: rendererConfig



```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```
#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```
#### getter: showLabels



```js
// Type
any
```
#### action: toggleShowLabels



```js
// Type signature
toggleShowLabels: () => void
```
#### getter: showDescriptions



```js
// Type
any
```
#### action: toggleShowDescriptions



```js
// Type signature
toggleShowDescriptions: () => void
```
#### action: setDisplayMode



```js
// Type signature
setDisplayMode: (val: string) => void
```
#### action: navToLocString


navigate to the given locstring
```js
// Type signature
navToLocString: (locString: string, optAssemblyName?: string) => void
```
#### action: showTrack



```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}, displayInitialSnapshot?: {}) => any
```
