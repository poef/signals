const signalHandler = {
	get: (target, property, receiver) => {
		notifyGet(receiver, property)
		return target[property]
	},
	set: (target, property, value, receiver) => {
		target[property] = value
		notifySet(receiver, property)
		return true
	},
	has: (target, property, receiver) => {
		notifyGet(receiver, property)
		return hasOwnKey(target, property)
	},
	deleteProperty: (target, property, receiver) => {
		delete target[property]		
		notifySet(receiver, property)
	}
}

export function signal(v) {
	return new Proxy(v, signalHandler)
}

function notifySet(self, property) {
	for (let listener of getListeners(self, property)) {
		listener()
	}
}

function notifyGet(self, property) {
	let currentCompute = computeStack[computeStack.length-1]
	if (currentCompute) {
		// get was part of a react() function, so add it
		setListeners(self, property, currentCompute)
	}
}

const listenersMap = new WeakMap()

function getListeners(self, property) {
	let listeners = listenersMap.get(self)
	return listeners?.[property] ?? []
}

function setListeners(self, property, compute) {
	if (!listenersMap.has(self)) {
		listenersMap.set(self, {})
	}
	let listeners = listenersMap.get(self)
	if (!listeners[property]) {
		listeners[property] = new Set()
	}
	listeners[property].add(compute)
	listenersMap.set(self, listeners)
}

const computeStack = []

const signals = new WeakMap()

const reactStack = []
export function react(fn) {
	if (reactStack.findIndex(fn)!==-1) {
		throw new Error('Recursive react() call', {cause:fn})
	}
	reactStack.push(fn)

	let connectedSignal = signals.get(fn)
	if (!connectedSignal) {
		connectedSignal = signal({})
		signals.set(fn, connectedSignal)
	}
	let reactor = () => {
		let result = fn()
		Object.assign(connectedSignal, result)
	}
	computeStack.push(reactor)
	reactor()
	computeStack.pop()
	return connectedSignal
}

/*
issues:
- signal(v) -> v must be an object
- fn() -> result must be an object
- no lazy evaluation yet
*/