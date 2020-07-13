---
id: developer_creating_renderers
title: Creating custom renderers
---

### What is a renderer

In JBrowse 1, a track type typically would directly call the data parser and do
it's own rendering. In JBrowse 2, the data parsing and rendering is offloaded
to a web-worker or other RPC. This allows things to be faster in many cases.
This is conceptually related to "server side rendering" or SSR in React terms.

![](/jb2/img/renderer.png)
Conceptual diagram of how a track calls a renderer using the RPC

Important note: you can make custom tracks types that do not use this workflow,
but it is a built in workflow that works well for the core track types in
JBrowse 2.

### How to create a new renderer

The fundamental aspect of creating a new renderer is creating a class that
implements the "render" function. A renderer is actually a pair of a React
component that contains the renderer's output, which we call the "rendering"
and the renderer itself

    class MyRenderer implements ServerSideRendererType {
        render(props) {
            const {width, height, regions, features} = props
            const canvas = createCanvas(width, height)
            const ctx = canvas.getContext('2d')
            ctx.fillStyle='red'
            ctx.drawRect(0, 0, 100, 100)
            const imageData = createImageBitmap(canvas)
            return {
                element: React.createElement(this.ReactComponent, {...props}),
                imageData,
                height,
                width,
            }
        }
    }

In the above simplified example, our renderer creates a canvas using width and
height that are supplied via arguments, and draw a rectangle. We then return a
React.createElement call which creates a "rendering" component that will
contain the output

Note that the above canvas operations use an OffscreenCanvas for Chrome, or in
other browsers serialize the drawing commands to be drawn in the main thread

### What other special things can I do in a renderer?

The renderer is actually involved in data fetching. The base
ServerSideRendererType class has a getFeatures function that, in turn, calls
your data adapter's getFeatures function, but if you need tighter control over
how your data adapter's getFeatures method is called then your renderer. The
Hi-C renderer type does not operate on conventional features and instead works
with contact matrices, so the Hi-C renderer has a custom getFeatures function

```
    import {toArray} from 'rxjs/operators'
    class HicRenderer extends ServerSideRendererType {
        getFeatures(args) {
            const {dataAdapter, regions} = args
            const features = await dataAdapter
               .getFeatures(regions[0])
               .pipe(toArray())
               .toPromise()
            return features
        }
    }

```

### Renderer implementation notes

Note: The features argument that the renderer typically get's is a Map<string,
Feature>

    class MyRenderer extends ServerSideRendererType {
        render(props) {
            const {features, width, height} = props
            for(const feature in features.values()) {
                // iterate over the ES6 map of features
            }
        }
    }
