const signalHandler = {
    get: (target, property, receiver) => {
        const value = target?.[property]
        notifyGet(receiver, property)
        if (typeof value === 'function') {
            if (Array.isArray(target)) {
                return (...args) => {
                    let l = target.length
                    // by binding the function to the receiver
                    // all accesses in the function will be trapped
                    // by the Proxy, so get/set/delete is all handled
                    let result = value.apply(receiver, args)
                    if (l != target.length) {
                        notifySet(receiver, 'length')
                    }
                    return result
                }
            } else if (target instanceof Set || target instanceof Map) {
                return (...args) => {
                    let s = target.size
                    // node doesn't allow you to call set/map functions
                    // bound to the receiver.. so using target instead
                    // there are no properties to update anyway, except for size
                    let result = value.apply(target, args)
                    if (s != target.size) {
                        notifySet(receiver, 'size')
                    }
                    // there is no efficient way to see if the function called
                    // has actually changed the Set/Map, but by assuming the
                    // 'setter' functions will change the results of the
                    // 'getter' functions, effects should update correctly
                    if (['set','add','clear','delete'].includes(property)) {
                        notifySet(receiver, ['entries','forEach','has','keys','values',Symbol.iterator])
                    }
                    return result
                }
            } else {
                return value.bind(receiver)
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
    deleteProperty: (target, property) => {
        if (typeof target[property] !== 'undefined') {
            delete target[property]
            let receiver = signals.get(target) // receiver is not part of the trap arguments, so retrieve it here
            notifySet(receiver, property, true)
        }
        return true
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
function notifySet(self, properties, isdelete=false) {
    if (!Array.isArray(properties)) {
        properties = [properties]
    }
    let listeners = []
    properties.forEach(property => {
        let propListeners = getListeners(self, property)
        if (propListeners?.size) {
            listeners = listeners.concat(Array.from(propListeners))
        }
    })
    listeners = new Set(listeners.filter(Boolean))
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
    return listeners?.get(property)
}

/**
 * Adds an update function (compute) to the list of listeners on
 * the given signal (self) and property
 */
function setListeners(self, property, compute) {
    if (!listenersMap.has(self)) {
        listenersMap.set(self, new Map())
    }
    let listeners = listenersMap.get(self)
    if (!listeners.has(property)) {
        listeners.set(property, new Set())
    }
    listeners.get(property).add(compute)

    if (!computeMap.has(compute)) {
        computeMap.set(compute, new Map())
    }
    let connectedSignals = computeMap.get(compute)
    if (!connectedSignals.has(property)) {
        connectedSignals.set(property, new Set)
    }
    connectedSignals.get(property).add(self)
}

/**
 * Removes alle listeners that trigger the given reactor function (compute)
 * This happens when a reactor is called, so that it can set new listeners
 * based on the current call (code path)
 */
function clearListeners(compute) {
    let connectedSignals = computeMap.get(compute)
    if (connectedSignals) {
        connectedSignals.forEach(property => {
            property.forEach(s => {
                let listeners = listenersMap.get(s)
                if (listeners.has(property)) {
                    listeners.get(property).delete(compute)
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
