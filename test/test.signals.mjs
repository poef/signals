import { signal, update } from '../src/signals.mjs'
import tap from 'tap'

tap.test(t => {
	let A = signal({value: 'A'})

	let B = signal({value: 'B'})

	let C = update(() => {
		return { value: A.value + B.value }
	})	

	t.same(C, {
		value: 'AB'
	})

	let D = update(() => {
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
