---
id: dotplotdisplay
title: DotplotDisplay
toplevel: true
---




### DotplotDisplay - Properties
#### property: type



```js
// type signature
ISimpleType<"DotplotDisplay">
// code
type: types.literal('DotplotDisplay')
```

#### property: configuration



```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```


### DotplotDisplay - Getters
#### getter: rendererTypeName



```js
// type
any
```


### DotplotDisplay - Methods
#### method: renderProps



```js
// type signature
renderProps: () => any
```


### DotplotDisplay - Actions
#### action: setLoading



```js
// type signature
setLoading: (abortController: AbortController) => void
```

#### action: setMessage



```js
// type signature
setMessage: (messageText: string) => void
```

#### action: setRendered



```js
// type signature
setRendered: (args?: { data: any; reactElement: React.ReactElement; renderingComponent: React.Component; }) => void
```

#### action: setError



```js
// type signature
setError: (error: unknown) => void
```

 
