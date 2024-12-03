# One-way data-bind with SimplySignal

SimplyEdit implements a two-way databinding, optimized for editing content live in the browser. While this works well, there are a few things we'd like to improve. And the choice to go for editing content as the main use-case has had impact on building web applications with SimplyEdit's databinding.

The bind() implementation in this library explores the possibilities of building on top of the Signal/Effect abstraction, as well as some options that could be a better fit for building web applications. The current implementation is only one-way, changes in data are rendered in the DOM, not the other way around. However, a later version could add support for two-way databinding, if needed.

## 1. Signals are more robust than adding getter/setter functions

Specifically, getter and setter methods are not capable of detecting deletion of properties. This means a whole lot of handwritten code to check and restore bindings after the fact. Signals use the new Proxy() capabilities of the browser, which allow the direct detection of deletion of properties. This implementation also allows improved support for array functions like push(), pop(), sort(), etc. In fact, it should support Map() and Set() objects, or any custom defined javascript classes.

## 2. There is no distinction between fields and lists, there is only `data-bind`.

If a bound value is an array, and there is a template element inside the bound element, bind() will use that template to create new dom elements for each entry in the array. You don't need to specify this, it works automatically. Because there is no distinction anymore, arrays will use transformers (once implemented) exactly like other kinds of values. There will be support to iterate over properties of an object as well.

## 3. There is a default transformer that handles normal rendering, but you can add your own transformers as well. 

Instead of just one transformer per element, you can add a list of transformers. Each will be called by the previous one, or skipped. Each transformer is called with a data parameter and a next function. E.g:

```javascript
transformer('position', (data,next) => {
	// do something here
	data = next(data)
	this.style.top = data.top+'px'
	this.style.left = data.left+'px'
	return data
})
```

And you specify transformers like this:

```html
<div data-bind="foo" data-bind-transformers="position">Foo</div>
```

This will first call the transformer 'position', which, using the next() method will call the default transformer, which does the default rendering. A transformer can change the data for the next() step, as well as return modified data and change attributes of the current DOM element.

## 4. There can be more than one bind 

bind() allows you to specify a root signal. Only signals inside that root are observed and used. But you can call bind() multiple times, each time with a different root, or a different container element or a different attribute instead of the default `data-bind`. This makes it possible to use different applications on the same page, without conflicts.

## 5. Effects

This adds the option to automatically update data rendered by bind, through custom code. You get this for free because bind() uses the Signals and Effect abstraction. 

## 6. Rendering is optimized and self-healing

Because of the automatic fine-grained updates that Signals and Effects allow, bind() will only update the parts of the DOM that actually need updating. And although the current implementation is one-way, list rendering is written so that it will automatically 'repair' the DOM if needed. An example is the kanban demo using Sortablejs. The Sortable code moves dom elements around. But the moment that it is done, the list updates will trigger a repair step to keep all list related data in sync.

## 7. More control over the full json path in data-bind attribute

Instead of using the path specified in the list, and magically prepending that behind the scenes, bind() explicitly puts the full json path in data-bind attributes rendered inside templates. This happens automatically, so the list path is still prepended, but it is reflected in the actual data-bind path. So this:

```html
<ul data-bind="foo.menu">
	<template>
		<li><a data-bind="link"></a></li>
	</template>
</ul>
```

Will create this dom structure:
```html
<ul data-bind="foo.menu">
	<template>
		<li><a data-bind="link"></a></li>
	</template>
	<li data-bind-key="0"><a data-bind="foo.menu.0.link" href="#bar">Bar</a></li>
	<li data-bind-key="1"><a data-bind="foo.menu.1.link" href="#baz">Baz</a></li>
</ul>
```

Note that the template element hasn't been removed.

You can prevent this prepending, by using the special `data-bind="#root.bar"` format. The `#root` part will always point to the root signal used in the bind() call.

Other special names are `#key` and `#value`, which allow you to use the key or value of an array item explicitly.

## 8. Server-side Rendering capable

Because template elements aren't removed from the dom, and list rendering 'self-repairs', you can use nodejs + jsdom to render data-bind instructions server-side. The client side bind() calls will pick up the existing rendered values and only update those elements where things have changed.

This won't run the actually included code in the HTML page server-side, you will need to manually provide the data, transformers and html to render it. A demo will follow.

