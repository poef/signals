import { signal, react } from './signal.mjs'

let A = signal({value: 'A'})
let B = signal({value: 'B'})
let C = react(() => {
	return { value: A.value + B.value }
})

console.log(C)
A.value='X'
console.log(C)
