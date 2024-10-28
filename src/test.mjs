import { signal, update } from './signal.mjs'

let A = signal({value: 'A'})
let B = signal({value: 'B'})
let C = update(() => {
	return { value: A.value + B.value }
})
let D = update(() => {
	return { value: C.value + B.value }	
})
console.log(C, D)
A.value='X'
console.log(C, D)
