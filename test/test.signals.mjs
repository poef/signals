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

tap.test('immutable effect results', t => {
	let A = signal({value: 'A'})
	let B = effect(() => {
		return { value: A.value+'B'}
	})
	t.throws(() => {
		B.value = 'X'; // overwrite computed value
	})
	t.end();
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
	let D = effect(() => {
		return {
			value: C[0]
		}
	})
	t.same(D.value, C[0])
	t.same(C[0],A)
	C.reverse()
	t.same(D.value, C[0])
	t.same(C[0], B)
	t.end()
})
