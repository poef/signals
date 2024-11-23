import { signal, effect, throttledEffect } from './signals.mjs'

export function bind(options) {
	const defaultOptions = {
		container: document.body,
		attribute: 'data-bind'
	}
	if (!options?.root) {
		throw new Error('bind needs at least options.root set')
	}
	options = Object.assign({}, defaultOptions, options)

    const updateBindings = (changes) => {
        for (const change of changes) {
            if (change.type=="childList" && change.addedNodes) {
                for (let node of change.addedNodes) {
                    if (node instanceof HTMLElement) {
                        let bindings = node.querySelectorAll('[data-bind]')
                        if (bindings.length) {
                            applyBindings(bindings)
                        }
                    }
                }
            }
        }
    }

    const handleChanges = (changes) => {
        updateBindings(changes)
    }

    var observer = new MutationObserver((changes) => {
        handleChanges(changes)
    })
    observer.observe(options.container, {
        subtree: true,
        childList: true
    })

    const applyBindings = (bindings) => {
        for (let bindingEl of bindings) {
            let path = getBindingPath(bindingEl)
            render(bindingEl, options.root, path)
        }
    }

	const applyTemplate = (el, template, list, index) => {
	    let clone = template.content.cloneNode(true)
	    if (clone.children.length>1) {
	        throw new Error('template must contain a single root node', { cause: template })
	    }
	    const bindings = clone.querySelectorAll('['+options.attribute+']')
	    for (let binding of bindings) {
	        binding.dataset.bind = el.dataset.bind+'.'+index+'.'+binding.dataset.bind
	    }
	    clone.children[0].setAttribute(options.attribute+'-key',index)
	    el.appendChild(clone)
	}

	const render = (el, root, path) => {
	    let template = el.querySelector('template')
	    let length = 0
	    throttledEffect(() => { // FIXME: throttledEffect runs once too much (extra time at the end)
	        const value = getValueByPath(root, path)
	        if (Array.isArray(value) && template) {
	            if (length > value.length) {
	                while (length > value.length) {
	                    let child = el.querySelector(':scope > :nth-child('+(length+1)+')')
	                    child.remove()
	                    length--
	                }
	            } else if (length < value.length ) {
	                while (length < value.length) {
	                    length++
	                    applyTemplate(el, template, value, length-1)
	                }
	            }
	            length = value.length
	        } else if (el.tagName=='INPUT') {
	            if (el.type=='checkbox' || el.type=='radio') {
	                if (el.value == value) {
	                    el.checked = true
	                } else {
	                    el.checked = false
	                }
	            } else {
	                el.value = value
	            }
	        } else if (el.tagName=='BUTTON') {
	            el.value = value
	        } else if (el.tagName=='SELECT') {
	            if (el.multiple) {
	                if (Array.isArray(value)) {
	                    for (let option of el.options) {
	                        if (value.indexOf(option.value)===false) {
	                            option.selected = false
	                        } else {
	                            option.selected = true
	                        }
	                    }
	                }
	            } else {
	                let option = el.options.find(o => o.value==value)
	                if (option) {
	                    option.selected = true
	                }
	            }
	        } else {
	            el.innerHTML = value
	        }
	    }, 100)
	}
	
	const getBindingPath = (el) => {
	    return el.getAttribute(options.attribute)
	}

    var bindings = options.container.querySelectorAll('[data-bind]')
    if (bindings.length) {
        applyBindings(bindings)
    }
}

function getValueByPath(root, path) {
    let parts = path.split('.');
    let curr = root;
    let part, prevPart;
    while (parts.length && curr) {
        part = parts.shift()
        if (part=='#key') {
            return prevPart
        } else if (part=='#value') {
            return curr
        } else {
            curr = curr[part];
            prevPart = part
        }
    }
    return curr
}
