# SimplySignal - Write simple reactive code.

## Introduction

```javascript
import {signal, effect} from '@muze-nl/simplysignal'

let todos = signal([])

let counter = effect(() => {
	return todos.filter(todo => !todo.done).length
})

todos.push({title: "Buy milk", done: false})

console.log(counter.current) // prints 1
```

If you haven't seen reactive code before, it works very similar to how a spreadsheet updates cells with a formula inside. Whenever you change a number, the affected formulas re-calculate their values automatically. In the same way, whenever you change a Signal value, affected Effects are re-run and update their result Signal.

The two core concepts are Signals and Effects.

A Signal is an object which keeps track of get/set access to itself. You create a Signal like this:

```javascript
import {signal} from '@muze-nl/simplysignal'

let foo = signal({ bar: "bar" })

console.log(foo.bar) // prints "bar"
```

A signal must be an object (or an array). You cannot create a signal with just a string, number or boolean. If you need to do that, wrap the value in an object, e.g.:

```javascript
let s = signal({ value: "bar" })
```

An Effect is a function that is (re)run whenever a Signal that it uses changes. You create an effect like this:

```javascript
import {signal, effect} from '@muze-nl/simplysignal'

let todos = signal([])

let counter = effect(() => {
	return todos.filter(todo => !todo.done).length
})

todos.push({title: "Buy milk", done: false})

console.log(counter.current) // prints 1
```

In this case the effect returns something, an object. That is automatically turned into a Signal. You don't have to return anything in an effect, but if you do, it must be an object (or an array). Doing this means that you can use the result of the effect as a dependency in another effect.

Effects must not be called recursively, if you try, the effect will throw an error. You also cannot depend on a signal that is the result of this effect - that would generate a cyclical dependency that could never be resolved. If you try, the effect will also throw an error.

## Installation

```shell
npm install @muze-nl/simplySignal
```
And then:

```javascript
import { signal, effect } from '@muze-nl/simplySignal'
```
Or you can use a CDN, e.g:

```html
<script type="module">
	import { signal, effect } from 'https://cdn.jsdelivr.net/gh/poef/signals/src/signals.mjs'
```

## API

### signal()

```javascript
const mySignal = signal({
	foo: 'bar'
})
```

Creates a signal from a given object. This object may also be an Array, a Set or a Map, or an instance of your own class definition.

The returned signal is a completely transparent Proxy for that object, and you should be able to use it anywhere that the original object could be used.

Signals only have additional effects when used inside an `effect()` function.

### effect()

```javascript
const myComputedSignal = effect(() => {
	return mySignal.foo
})
```

An effect is a function that is called immediately when one of the signals it uses changes. This is a synchronous update, so this works:

```javascript
let counter = signal({
	value: 1
})
let computed = effect(() => {
	return counter.value * 10
})
console.log(computed.current) // displays (number) 10
counter.value++
console.log(computed.current) // displays (number) 20
```

Effects can not use circular dependencies. You are not allowed to create an effect that depends on a computed signal that changes because of the current effect. That would create an infinite loop.

You also cannot create a recursive call inside an effect, even if it wouldn't cause an infinite loop. This is because simplySignal cannot detect that this is the case, and so counts this as a potential infinite loop.

You can create an asynchronous effect, like this:

```javascript
let url = signal({ value: new URL('https://mysite/api/foo') })
let response = effect(async () => {
	return await fetch(url.value)
})
console.log(response.current) // will display 'null'
```

Because the effect function uses `await`, you must declare the effect function as `async`. This means that `response` will be set after `fetch` returns the response.

You cannot chain `.then()` calls outside the async function, the response signal is also not a Promise. If you need to chain await or `.then`, you must do so inside the async effect function:

```javascript
let url = signal({ value: new URL('https://mysite/api/foo') })
let response = effect(async () => {
	let response = await fetch(url.value)
	if (response.ok) {
		return response.json() //another promise
	}
	throw new Error('Network error '+response.status)
})
console.log(response.current) // will still display 'null'
```

You can create an effect that uses the computedSignal from the async effect to handle the result, whenever it changes, e.g:

```javascript
let url = signal({ value: new URL('https://mysite/api/foo') })
let apiResult = effect(async () => {
	let response = await fetch(url.value)
	if (response.ok) {
		return response.json() //another promise
	}
	throw new Error('Network error '+response.status)
})
effect(() => {
	if (apiResult.current) {
		console.log(apiResult.current)
	}
})
```

Now whenever the url.value changes, the apiResult will update asynchonously, and when it does, the final effect will log the result of that call.

Important: The asynchronous effect function will only be called whenever a signal used before the first `await` or `.then` call changes. Any signals used after that are not detected as a dependency. This is because of how `async`/`await` or Promises work in javascript and cannot be avoided. If you do have such a dependency, make sure you read it-and perhaps set it in a temporary variable-before the first `await` or `.then` call.

### batch()

```javascript
let foo = signal({ value: 'Foo'})
let bar = signal({ value: 'Bar'})
let count = 1
let baz = effect(() => {
	return '"'+foo.value+'":"'+bar.value+'"'+(count++)
})
batch(() +> {
	foo.value = 'foo'
	bar.value = 'bar'
})
console.log(baz.current) // displays: "foo:bar"1
```

The `batch` function allows you to update multiple signals, without triggering effects more than once. Only after your batch function finishes will all effects that depend on changes you made inside the batch function, update.

Unlike some other Signal/Effect implementations, effects always run immediately when a signal they depend on changes. This does help in making sure that the computed signal from an effect always has the correct value. In detail: simplySignal is glitch-free. But it does mean that effects sometimes run too often, e.g. when you update multiple signals. 

The batch() function allows you to prevent this.

### throttledEffect()

```javascript
let foo = signal({ value: 1 })
let bar = throttledEffect(
	() => {
		return foo.value + 1 // imagine a very cpu intensive operation here
	},
	10 // run at most once per 10ms
)
for (let i=0;i<100;i++) {
	foo.value++
}
```

A throttledEffect is identical to a normal effect, except that it will limit updating the effect function to once per given timeperiod, here that is 10ms.

Whenever a change in a signal that it depends on occurs, the effect will run immediately, unless it was called earlier, less than the given timeperiod. After that time period, the effect will update (get called again) if in the mean time a dependency has changed.

In the example code above, the effect is run twice. Once upon definition, as all effects are. And then once after 10ms, because `foo.value` has changed.

### clockEffect()

```javascript
let foo = signal({ value: 0 })
let clock = signal({ time: 0 })
let bar = clockEffect(
	() => {
		console.log(clock.time+': '+foo.value)
	},
	clock
) // console prints '0:0'
foo.value++
// no console log triggered
clock.time++
// console prints '1:1'
clock.time++
// no console log triggered
foo.value++
// no console log triggered
clock.time++
// console prints '3:2'
```

A clockEffect is an effect that is only triggered if the clock.time signal is increased, and any other dependency has changed since the last time the clockEffect has run.

This allows you to create effects with lots of interconnected dependencies, which only run once when the clock progresses. This way you can make cyclical dependencies and not create infinite loops. 
