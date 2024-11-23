import { signal, effect, throttledEffect } from './signals.mjs'

export function bind(container, root) {
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
    observer.observe(container, {
        subtree: true,
        childList: true
    })

	const applyBindings = (bindings) => {
		for (let bindingEl of bindings) {
			let path = getBindingPath(bindingEl)
			render(bindingEl, root, path)
		}
	}

    var bindings = container.querySelectorAll('[data-bind]')
    if (bindings.length) {
        applyBindings(bindings)
    }
}

function render(el, root, path) {
	let template = el.querySelector('template')
	let length = 0
	throttledEffect(() => { // FIXME: throttledEffect runs once too much (extra time at the end)
		let [model, property] = getByPath(root, path) // must be inside effect to keep track of accessed signals
		const value = model?.[property]
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
			el.value = value
		} else {
			el.innerHTML = value
		}
	}, 100)
}

function applyTemplate(el, template, list, index) {
	let clone = template.content.cloneNode(true)
	const bindings = clone.querySelectorAll('[data-bind]')
	for (let binding of bindings) {
		binding.dataset.bind = el.dataset.bind+'.'+index+'.'+binding.dataset.bind
	}
	el.appendChild(clone)
}

function getByPath(root, path) {
    var parts = path.split('.');
    var curr = root;
    while (parts.length>1 && curr) {
        curr = curr[parts.shift()];
    }
    return [curr, parts.pop()];
}

function getBindingPath(el) {
	return el.dataset.bind
}
