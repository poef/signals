# SimplySignal - Write simple reactive code.

## Introduction

```javascript
import {signal, effect} from '@muze-nl/simplysignal'

let todos = signal([])

let counter = effect(() => {
	return {todo: todos.filter(todo => !todo.done).length}
})

todos.push({title: "Buy milk", done: false})

console.log(counter.todo) // prints 1
```

If you haven't seen reactive code before, it works very similar to how a spreadsheet updates cells with a formula inside. Whenever you change a number, the affected formulas re-calculate their values automatically. In the same way, whenever you change a Signals value, affected Effects are re-run and update their result Signal.

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
	return {todo: todos.filter(todo => !todo.done).length}
})

todos.push({title: "Buy milk", done: false})

console.log(counter.todo) // prints 1
```

In this case the effect returns something, an object. That is automatically turned into a Signal. You don't have to return anything in an effect, but if you do, it must be an object (or an array). Doing this means that you can use the result of the effect as a dependency in another effect.

Effects must not be called recursively, if you try, the effect will throw an error. You also cannot depend on a signal that is the result of this effect - that would generate a cyclical dependency that could never be resolved. If you try, the effect will also throw an error.

## Installation

## API

### signal()

### effect()