const signalHandler = {
    get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver)
        notifyGet(receiver, property)
        if (typeof value === 'function') {
            if (Array.isArray(target)) {
                return (...args) => {
                    let l = target.length
                    // by binding the function to the receiver
                    // all accesses in the function will be trapped
                    // by the Proxy, so get/set/delete is all handled
                    let fn = value.bind(receiver)
                    let result = fn(...args)
                    if (l != target.length) {
                        notifySet(receiver, 'length')
                    }
                    return result
                }
            } else {
                return (...args) => {
                    let fn = value.bind(receiver)
                    let result = fn(...args)
                    // TODO: support Set.size?
                    return result
                }
            }
        }
        if (value && typeof value == 'object') {
            //NOTE: get now returns a signal, set doesn't 'unsignal' the value set
            return signal(value)
        }
        return value
    },
    set: (target, property, value, receiver) => {
        if (target[property]!==value) {
            target[property] = value //FIXME: should we unwrap a signal here?
            notifySet(receiver, property)
        }
        return true
    },
    has: (target, property) => { // receiver is not part of the has() call
        let receiver = signals.get(target) // so retrieve it here
        if (receiver) {
            notifyGet(receiver, property)
        }
        return Object.hasOwn(target, property)
    },
    deleteProperty: (target, property, receiver) => {
        if (typeof target[property] !== 'undefined') {
            delete target[property]        
            notifySet(receiver, property)
        }
    }
}

/**
 * Keeps track of the return signal for an update function, as well
 * as signals connected to other objects. 
 * Makes sure that a given object or function always uses the same
 * signal
 */
const signals = new WeakMap()

/**
 * Creates a new signal proxy of the given object, that intercepts get/has and set/delete
 * to allow reactive functions to be triggered when signal values change.
 */
export function signal(v) {
    if (!signals.has(v)) {
        signals.set(v, new Proxy(v, signalHandler))
    }
    return signals.get(v)
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
    property = 'prop:'+property
    let listeners = listenersMap.get(self)
    return listeners?.[property]
}

/**
 * Adds an update function (compute) to the list of listeners on
 * the given signal (self) and property
 */
function setListeners(self, property, compute) {
    property = 'prop:'+property // avoid name collisions with properties like 'constructor'
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
 * Used for cycle detection: effectStack contains all running effect
 * functions. If the same function appears twice in this stack, there
 * is a recursive update call, which would cause an infinite loop.
 */
const effectStack = []

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
    if (effectStack.findIndex(f => fn==f)!==-1) {
        throw new Error('Recursive update() call', {cause:fn})
    }
    effectStack.push(fn)

    let connectedSignal = signals.get(fn)
    if (!connectedSignal) {
        connectedSignal = signal({})
        signals.set(fn, connectedSignal)
    }

    // this is the function that is called automatically
    // whenever a signal dependency changes
    const computeEffect = function computeEffect() {
    	if (signalStack.findIndex(s => s==connectedSignal)!==-1) {
    		throw new Error('Cyclical dependency in update() call', { cause: fn})
    	}
        // remove all dependencies (signals) from previous runs 
        clearListeners(computeEffect)
        // record new dependencies on this run
        computeStack.push(computeEffect)
        // prevent recursion
        signalStack.push(connectedSignal)
        // call the actual update function
        let result = fn()
        // stop recording dependencies
        computeStack.pop()
        // stop the recursion prevention
        signalStack.pop()

        Object.assign(connectedSignal, result)
    }
    // run the computEffect immediately upon creation
    computeEffect()
    return connectedSignal
}
