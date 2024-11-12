import { signal, effect, batch, throttledEffect, clockEffect } from '../src/signals.mjs'
import tap from 'tap'

tap.test('objects', t => {
	let A = signal({value: 'A'})

	let B = signal({value: 'B'})

	let C = effect(() => {
		return A.value + B.value
	})	

	t.same(C, {
		current: 'AB'
	})

	let D = effect(() => {
		return C.current + B.value
	})

	t.same(D, {
		current: 'ABB'
	})

	A.value = 'X'

	t.same(C, {
		current: 'XB'
	})
	t.same(D, {
		current: 'XBB'
	})
	t.end()
})

tap.test('arrays', t => {
	let A = signal([1,2])
	let B = effect(() => {
		return A.length
	})
	t.equal(B.current, A.length)
	t.equal(B.current, 2)
	A.push(3)
	t.equal(B.current, A.length)
	t.equal(B.current, 3)
	t.end()
})

tap.test('cycles', t => {
	let A = signal({value: 'A'})
	let B = signal({current: 'B'})
	B = effect(() => {
		return A.value+B.current
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
	t.same(D.current.value, C[0])
	t.same(C[0], A)
	t.same(D.current.count, 1) // makes sure the effect has run once
	C.reverse()
	t.same(D.current.value, C[0])
	t.same(C[0], B)
	t.same(D.current.count, 2) // makes sure that the effect has run exactly once more
	t.end()
})

tap.test('deep object signals', t => {
	let A = signal({
		foo: {
			bar: "baz"
		}
	})
	let B = effect(() => {
		return 'foo.bar is now '+A.foo.bar
	})
	t.same(B.current, 'foo.bar is now baz')
	A.foo.bar = 'bar'
	t.same(B.current, 'foo.bar is now bar')
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
		return todos.filter(todo => !todo.done).length
	})

	todos.push({title: "Buy milk", done: false})

	t.same(counter.current, 1)
	todos[0].done = true
	t.same(counter.current, 0)
	t.end()
})

tap.test('deep delete', t => {
	let foo = signal({
		bar: {
			baz: "baz"
		}
	})
	let bar = effect(() => {
		return foo?.bar?.baz
	})
	t.same(bar.current, 'baz')
	delete foo.bar
	t.same(bar.current, null)
	foo.bar = {
		baz: "baz2"
	}
	t.same(bar.current, 'baz2')
	t.end()
})

tap.test('Set', t => {
	let foo = signal(new Set())
	foo.add(1)
	let bar = effect(() => {
		return foo.size
	})
	t.same(bar.current, 1)
	foo.add(2)
	t.same(bar.current, 2)
	foo.add(1)
	t.same(bar.current, 2)
	t.end()
})

tap.test('Set functions', t => {
	let foo = signal(new Set())
	foo.add(1)
	let bar = effect(() => {
		return Array.from(foo.values()).join(',')
	})
	t.same(bar.current, '1')
	foo.add(2)
	t.same(bar.current, '1,2')
	foo.add(1)
	t.same(bar.current, '1,2')
	t.end()
})

tap.test('Map', t => {
	let foo = signal(new Map())
	foo.set('bar', 'bar')
	let bar = effect(() => {
		return foo.size
	})
	t.same(bar.current, 1)
	foo.set('baz','baz')
	t.same(bar.current, 2)
	t.end()
})

tap.test('Map functions', t => {
	let foo = signal(new Map())
	foo.set('bar','bar')
	let bar = effect(() => {
		return Array.from(foo.values()).join(',')
	})
	t.same(bar.current, 'bar')
	foo.set('baz','baz')
	t.same(bar.current, 'bar,baz')
	t.end()
})

class Foo {
	#bar

	constructor() {
		this.#bar = 'bar'
	}

	toString() {
		return '"'+this.bar+'"'
	}

	get bar() {
		return this.#bar
	}

	set bar(value) {
		this.#bar = value
	}
}

tap.test('Custom class', t => {
	let foo = signal(new Foo())
	let bar = effect(() => {
		return foo.toString()
	})
	t.same(foo.bar, 'bar')
	t.same(bar.current, '"bar"')
	foo.bar = 'baz'
	t.same(foo.bar, 'baz')
	t.same(bar.current, '"baz"')
	t.end()
})

tap.test('batch mode', t => {
	let foo = signal({value: 'Foo'})
	let bar = effect(() => {
		return '"'+foo.value+'"'
	})
	batch(() => {
		foo.value = 'Bar'
		t.same(bar.current, '"Foo"')
		foo.value = 'Baz'
		t.same(bar.current, '"Foo"')
	})
	t.same(bar.current, '"Baz"')
	t.end()
})

tap.test('async effect', t => {
	let foo = signal({value: 'Foo'})
	let bar = effect(async () => {
		return '"'+foo.value+'"'
	})
	t.same(bar.current, null)
	setTimeout(() => {
		t.same(bar.current, '"Foo"')
		foo.value = 'Bar'
		t.same(bar.current, '"Foo"')
		setTimeout(() => {
			t.same(bar.current, '"Bar"')
			t.end()
		}, 10)
	},10)
})

tap.test('throttledEffect', t => {
	let foo = signal({ value: 1})
	let count = 0
	let bar = throttledEffect(() => {
		return foo.value+':'+count++
	}, 10)
	// throttled effect is called immediately
	t.same(bar.current, '1:0')
	for (let i=0;i<10;i++) {
		setTimeout(() => {
			foo.value++
		},1)
	}
	setTimeout(() => {
		// throttled effect called only once in each 10ms
		t.same(bar.current, '11:1')
		setTimeout(() => {
			// make sure that throttle end timeout is only called if foo.value has changed in the mean time
			t.same(bar.current, '11:1') 
			t.end()
		}, 20)
	}, 20)
})

tap.test('clockEffect', t => {
	let foo = signal({value: 1})
	let count = 0
	let clock = signal({
		time: 0
	})
	let bar = clockEffect(() => {
		return foo.value + ':' + count++
	}, clock)
	t.same(bar.current, '1:0')
	foo.value = 2
	foo.value = 3
	t.same(bar.current, '1:0') // only recompute if the clock has progressed
	clock.time += 1
	t.same(bar.current, '3:1') // so here
	clock.time += 1
	t.same(bar.current, '3:1') // and only recompute if foo.value has changed too
	t.end()
	
})

tap.test('glitch', t => {
	let seconds = signal({ value: 0})
	let q = effect(() => {
		return seconds.value + 1
	})
	let v = effect(() => {
		return q.current > seconds.value
	})
	for (let i=0;i<10;i++) {
		setTimeout(() => {
			seconds.value++
			t.same(q.current, seconds.value+1)
			t.same(v.current, true)
		})
	}
	setTimeout(() => {
		t.end()
	}, 20)
})