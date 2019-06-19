# About rendering

## What is in here

This directory contains very general renderer base classes that can be built off of by plugins.

## Server-side/web-worker rendering flow

This is the typical flow when something in the main thread needs to be rendered.

* Reaction in track or block MST model (e.g. serverSideRenderedBlock.js)
* Renderer type's `renderInClient` method. Serializes arguments to prepare for sending to worker.
* render.js `renderRegionWithWorker` gets a worker from the worker pool and calls
* remote procedure call (RPC) to `renderRegion` in a web worker (entry point rpc.worker.js)
* now in worker land, `renderRegion` instantiates the appropriate data adapter and renderer types and calls the renderer's `renderInWorker` method, passing it the data adapter
* the renderer's `renderInWorker` method deserializes arguments, fetches data from the adapter, and does the rendering, which always contain at least an `html` member containing some server-side-rendered React output. It returns the serialized results back up the call chain and out of the web worker to the client process.
* Back up the stack, in the renderer's `renderInClient` method, the results are deserialized and returned.
* In the block or track's MST model, the rendering results are stored in the model.
* The rendering React components are observing those server-side rendering results (via mobx-react `observer`), and re-render themselves to show those rendering results.
* The rendering results contain server-side-rendered React HTML, which is handled by a component like ServerSideRenderedContent.js, which inserts it into the DOM and calls React's `hydrate` method on it to turn it into a living React rendering in the main thread.
