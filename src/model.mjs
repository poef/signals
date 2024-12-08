import {signal} from '../src/signals.mjs'

export class Model {
	constructor(state) {
		this.state = signal(state)
		this.effects = [{current:state.data}]
		this.view = signal(state.data)
	}

	addEffect(fn) {
		const dataSignal = this.effects[this.effects.length-1]
		const effect = fn.call(this, dataSignal)
		this.effects.push(effect)
		this.view = this.effects[this.effects.length-1]
	}
}

