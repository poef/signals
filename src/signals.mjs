export const immutable = Symbol('immutable')

const signalHandler = {
    get: (target, property, receiver) => {
        if (typeof target[property]==='function') {
            if (Array.isArray(target)) {
                if (typeof property === 'symbol') {
                    return target[property] // iterators and stuff, don't mess with them
                }
                if (['copyWithin','fill','pop','push','reverse','shift','sort','splice','unshift']
                    .indexOf(property)!==-1)
                {
                    if (target[immutable]) {
                        throw new Error('This signal is immutable', {cause: receiver})
                    }
                    return (...args) => {
                        let temp = target.slice()
                        let result = target[property].apply(target, args)
                        if (temp.length!==target.length) {
                            notifySet(receiver, 'length') //FIXME:incorrect, any other property may have changed as well
                        }
                        for (let i=0,l=temp.length;i<l;i++) {
                            if (temp[i]!==target[i]) {
                                notifySet(receiver, i)
                            }
                        }
                        return result
                    }
                }
            }
        }
        notifyGet(receiver, property)
        return target[property]
    },
    set: (target, property, value, receiver) => {
        if (property===immutable) {
            target[property]=value
        } else if (target[property]!==value) {
            if (target[immutable]) {
                throw new Error('This signal is immutable', {cause: receiver})
            }
            target[property] = value
            notifySet(receiver, property)
        }
        return true
    },
    has: (target, property, receiver) => {
        notifyGet(receiver, property)
        return Object.hasOwn(target, property)
    },
    deleteProperty: (target, property, receiver) => {
        if (typeof target[property] !== 'undefined') {
            if (target[immutable]) {
                throw new Error('This signal is immutable', {cause: receiver})
            }
            delete target[property]        
            notifySet(receiver, property)
        }
    }
}

/**
 * Creates a new signal proxy of the given object, that intercepts get/has and set/delete
 * to allow reactive functions to be triggered when signal values change.
 */
export function signal(v) {
    return new Proxy(v, signalHandler)
}

/**
 * Called when a signal changes a property (set/delete)
 * Triggers any reactor function that depends on this signal
 * to re-compute its values
 */
function notifySet(self, property) {
    let listeners = getListeners(self, property)
    if (listeners) {
        for (let listener of Array.from(listeners)) {
            listener()
        }
    }
}

/**
 * Called when a signal property is accessed. If this happens
 * inside a reactor function--computeStack is not empty--
 * then it adds the current reactor (top of this stack) to its
 * listeners. These are later called if this property changes
 */
function notifyGet(self, property) {
    let currentCompute = computeStack[computeStack.length-1]
    if (currentCompute) {
        // get was part of a react() function, so add it
        setListeners(self, property, currentCompute)
    }
}

/**
 * Keeps track of which update() functions are dependent on which
 * signal objects and which properties. Maps signals to update fns
 */
const listenersMap = new WeakMap()

/**
 * Keeps track of which signals and properties are linked to which
 * update functions. Maps update functions and properties to signals
 */
const computeMap = new WeakMap()

/**
 * Returns the update functions for a given signal and property
 */
function getListeners(self, property) {
    let listeners = listenersMap.get(self)
    return listeners?.[property]
}

/**
 * Adds an update function (compute) to the list of listeners on
 * the given signal (self) and property
 */
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

    if (!computeMap.has(compute)) {
        computeMap.set(compute, {})
    }
    let connectedSignals = computeMap.get(compute)
    if (!connectedSignals[property]) {
        connectedSignals[property] = new Set
    }
    connectedSignals[property].add(self)
}

/**
 * Removes alle listeners that trigger the given reactor function (compute)
 * This happens when a reactor is called, so that it can set new listeners
 * based on the current call (code path)
 */
function clearListeners(compute) {
    let connectedSignals = computeMap.get(compute)
    if (connectedSignals) {
        Object.keys(connectedSignals).forEach(property => {
            connectedSignals[property].forEach(s => {
                let listeners = listenersMap.get(s)
                if (listeners?.[property]) {
                    listeners[property].delete(compute)
                }
            })
        })
    }
}

/**
 * The top most entry is the currently running update function, used
 * to automatically record signals used in an update function.
 */
const computeStack = []

/**
 * Keeps track of the return signal for an update function, so that
 * on re-running the update function, the same signal is updated.
 */
const signals = new WeakMap()

/**
 * Used for cycle detection: reactStack contains all running update
 * functions. If the same function appears twice in this stack, there
 * is a recursive update call, which would cause an infinite loop.
 */
const reactStack = []

/**
 * Used for cycle detection: signalStack contains all used signals. 
 * If the same signal appears more than once, there is a cyclical 
 * dependency between signals, which would cause an infinite loop.
 */
const signalStack = []

/**
 * Runs the given function at once, and then whenever a signal changes that
 * is used by the given function (or at least signals used in the previous run).
 */
export function effect(fn) {
    if (reactStack.findIndex(f => fn==f)!==-1) {
        throw new Error('Recursive update() call', {cause:fn})
    }
    reactStack.push(fn)

    let connectedSignal = signals.get(fn)
    if (!connectedSignal) {
        connectedSignal = signal({})
        signals.set(fn, connectedSignal)
    }

    // this is the function that is called automatically
    // whenever a signal dependency changes
    const reactor = function reactor() {
    	if (signalStack.findIndex(s => s==connectedSignal)!==-1) {
    		throw new Error('Cyclical dependency in update() call', { cause: fn})
    	}
        // remove all dependencies (singals) from previous runs 
        clearListeners(reactor)
        // record new dependencies on this run
        computeStack.push(reactor)
        // prevent recursion
        signalStack.push(connectedSignal)
        // call the actual update function
        let result = fn()
        // stop recording dependencies
        computeStack.pop()
        // stop the recursion prevention
        signalStack.pop()

        // outside this function, connectedSignal is immutable
        // and should throw an error when trying to change its
        // properties, because it should only change based
        // on the result of fn(). But here is where this is set
        // so the immutable Symbol is used to allow changes to
        // connectedSignal here.
        connectedSignal[immutable] = false
        Object.assign(connectedSignal, result)
        connectedSignal[immutable] = true
    }
    // always call the update function upon creation of the reactor
    reactor()
    return connectedSignal
}
