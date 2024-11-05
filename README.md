# SimplySignal - Write simple reactive code.

A simple reactive code library. SimplySignal provides a Signal and Effect implementation that work seamlessly together. Signals are variables that can trigger Effects whenever a signal changes. Effects are functions that are run automatically whenever a signal used in that function changes. An Effect in SimplySignal also returns and updates a Signal.

Create a Signal like this:

```javascript
import {signal} from '@muze-nl/simplysignal'

let foo = signal({ bar: "bar" })

console.log(foo.bar) // prints "bar"
```

A signal must be an object (or an array). You cannot create a signal with just a string, number or boolean. This is because SimplySignal uses Proxy to track access to a signal, and a Proxy can only work on objects.

The advantage is that a signal works just like any other object. So no other library needs to change to accept a signal as input.

Create an effect like this:

```javascript
import {signal, effect} from '@muze-nl/simplysignal'

let todos = signal([])
let todosLength = effect(() => {
	return {length: todos.length}
})
todos.push({title: "Buy milk"})
console.log(todosLength.length) // prints 1
```

As you can see, an effect returns another signal, one that changes whenever the effect is run again, because one of its dependencies has changed.

You don't need to assign this returned signal, you can just ignore it. But it means that you can use the calculated effect as a dependency in another effect.

Effects must not be called recursively, if you try, the effect will throw an error. You also cannot depend on a signal that is the result of this effect - that would generate a cyclical dependency that could never be resolved. If you try, the effect will also throw an error.