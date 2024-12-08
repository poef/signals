import {signal} from '../src/signals.mjs'

/**
 * This class implements a pluggable data model, where you can
 * add effects that are run only when either an option for that
 * effect changes, or when an effect earlier in the chain of
 * effects changes.
 */
export class Model {

	/**
	 * Creates a new datamodel, with a state property that contains
	 * all the data passed to this constructor
	 * @param state	Object with all the data for this model
	 */
	constructor(state) {
		this.state = signal(state)
		this.effects = [{current:state.data}]
		this.view = signal(state.data)
	}

	/**
	 * Adds an effect to run whenever a signal it depends on
	 * changes. this.state is the usual signal.
	 * The `fn` function param is not itself an effect, but must return
	 * and effect function. `fn` takes one param, which is the data signal.
	 * This signal will always have at least a `current` property.
	 * The result of the effect function is pushed on to the this.effects
	 * list. And the last effect added is set as this.view
	 */
	addEffect(fn) {
		const dataSignal = this.effects[this.effects.length-1]
		const effect = fn.call(this, dataSignal)
		this.effects.push(effect)
		this.view = this.effects[this.effects.length-1]
	}
}