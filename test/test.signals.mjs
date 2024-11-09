import { signal, effect } from '../src/signals.mjs'
import tap from 'tap'

tap.test('objects', t => {
	let A = signal({value: 'A'})

	let B = signal({value: 'B'})

	let C = effect(() => {
		return { value: A.value + B.value }
	})	

	t.same(C, {
		value: 'AB'
	})

	let D = effect(() => {
		return { value: C.value + B.value }	
	})

	t.same(D, {
		value: 'ABB'
	})

	A.value = 'X'

	t.same(C, {
		value: 'XB'
	})
	t.same(D, {
		value: 'XBB'
	})
	t.end()
})

tap.test('arrays', t => {
	let A = signal([1,2])
	let B = effect(() => {
		return { count: A.length }
	})
	t.equal(B.count, A.length)
	t.equal(B.count, 2)
	A.push(3)
	t.equal(B.count, A.length)
	t.equal(B.count, 3)
	t.end()
})

tap.test('cycles', t => {
	let A = signal({value: 'A'})
	let B = signal({value: 'B'})
	B = effect(() => {
		return { value: A.value+B.value}
	})
	t.throws(() => {
		A.value = 'X'; // expect to throw a cycle error here
	})
	t.end()
})

tap.test('array indexes', t => {
	let A = signal({value: 'A'})
	let B = signal({value: 'B'})
	let C = signal([A,B])
	let count = 1
	let D = effect(() => {
		return {
			count: count++,
			value: C[0]
		}
	})
	t.same(D.value, C[0])
	t.same(C[0], A)
	t.same(D.count, 1) // makes sure the effect has run once
	C.reverse()
	t.same(D.value, C[0])
	t.same(C[0], B)
	t.same(D.count, 2) // makes sure that the effect has run exactly once more
	t.end()
})

tap.test('deep object signals', t => {
	let A = signal({
		foo: {
			bar: "baz"
		}
	})
	let B = effect(() => {
		return { value: 'foo.bar is now '+A.foo.bar}
	})
	t.same(B.value, 'foo.bar is now baz')
	A.foo.bar = 'bar'
	t.same(B.value, 'foo.bar is now bar')
	t.end()
})

tap.test('array iterator', t => {
	let A = signal([1,2,3])
	let B = null
	for (let i of A) { // this is the test - can i iterate over a signal?
		B = i
	}
	t.same(B, A[2])
	t.same(B, 3)
	t.end()
})

tap.test('documentation code: todo', t => {
	const todos = signal([])

	const counter = effect(() => {
		return {todo: todos.filter(todo => !todo.done).length}
	})

	todos.push({title: "Buy milk", done: false})

	t.same(counter.todo, 1)
	todos[0].done = true
	t.same(counter.todo, 0)
	t.end()
})

tap.test('deep delete', t => {
	let foo = signal({
		bar: {
			baz: "baz"
		}
	})
	let bar = effect(() => {
		return { value: foo?.bar?.baz }
	})
	t.same(bar.value, 'baz')
	delete foo.bar
	t.same(bar.value, null)
	foo.bar = {
		baz: "baz2"
	}
	t.same(bar.value, 'baz2')
	t.end()
})

tap.test('Set', t => {
	let foo = signal(new Set())
	foo.add(1)
	let bar = effect(() => {
		return { count: foo.size }
	})
	t.same(bar.count, 1)
	foo.add(2)
	t.same(bar.count, 2)
	foo.add(1)
	t.same(bar.count, 2)
	t.end()
})

tap.test('Set functions', t => {
	let foo = signal(new Set())
	foo.add(1)
	let bar = effect(() => {
		return { joined: Array.from(foo.values()).join(',') }
	})
	t.same(bar.joined, '1')
	foo.add(2)
	t.same(bar.joined, '1,2')
	foo.add(1)
	t.same(bar.joined, '1,2')
	t.end()
})

tap.test('Map', t => {
	let foo = signal(new Map())
	foo.set('bar', 'bar')
	let bar = effect(() => {
		return { count: foo.size }
	})
	t.same(bar.count, 1)
	foo.set('baz','baz')
	t.same(bar.count, 2)
	t.end()
})

tap.test('Map functions', t => {
	let foo = signal(new Map())
	foo.set('bar','bar')
	let bar = effect(() => {
		return { joined: Array.from(foo.values()).join(',')}
	})
	t.same(bar.joined, 'bar')
	foo.set('baz','baz')
	t.same(bar.joined, 'bar,baz')
	t.end()
})

class Foo {
	constructor() {
		this.bar = 'bar'
	}

	toString() {
		return '"'+this.bar+'"'
	}
}

tap.test('Custom class', t => {
	let foo = signal(new Foo())
	let bar = effect(() => {
		return { bar: foo.toString() }
	})
	t.same(bar.bar, '"bar"')
	foo.bar = 'baz'
	t.same(bar.bar, '"baz"')
	t.end()
})