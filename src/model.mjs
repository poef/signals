import {signal, effect, batch} from '../src/signals.mjs'

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
		this.view = fn.call(this, dataSignal)
		this.effects.push(this.view)
	}
}

export function sortBy(data) {
	// initialize the sort options, only gets called once
	this.state.options.sortDirection = 'asc'
	this.state.options.sortBy = null
	this.state.options.sortFn = (a,b) => {
		const sortBy = this.state.options.sortBy
		const sortDirection = this.state.options.sortDirection
		const larger = sortDirection == 'asc' ? 1 : -1
		const smaller = sortDirection == 'asc' ? -1 : 1
		if (!sortBy) {
			return 0
		}
		if (typeof a?.[sortBy] === 'undefined') {
			if (typeof b?.[sortBy] === 'undefined') {
				return 0
			}
			return larger
		}
		if (typeof b?.[sortBy] === 'undefined') {
			return smaller
		}
		if (a[sortBy]<b[sortBy]) {
			return smaller
		} else if (a[sortBy]>b[sortBy]) {
			return larger
		} else {
			return 0
		}
	}
	// then return the effect, which is called when
	// either the data or the sort options change
	return effect(() => {
		if (this.state.options.sortBy) {
			return data.current.toSorted(this.state.options.sortFn)
		}
	})
}

export function paging(data) {
	// initialize the paging options
	this.state.options.page = 0
	this.state.options.pageSize = 20
	return effect(() => {
		return batch(() => {
			let page = this.state.options.page
			if (!this.state.options.pageSize) {
				this.state.options.pageSize = 20
			}
			let pageSize = this.state.options.pageSize
			const max = Math.floor((this.state.data.length-1) / pageSize)
			page = Math.max(0, Math.min(max, page))
			this.state.options.page = page

			const start = page * pageSize
			const end = start + pageSize
			return data.current.slice(start, end)
		})
	})
}
