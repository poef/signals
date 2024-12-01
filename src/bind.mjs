import { signal, effect, throttledEffect } from './signals.mjs'

export function bind(options)
{
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
            render(bindingEl, options.root)
        }
    }

    const applyTemplate = (path, template, list, index) => {
        let clone = template.content.cloneNode(true)
        if (clone.children.length>1) {
            throw new Error('template must contain a single root node', { cause: template })
        }
        const bindings = clone.querySelectorAll('['+options.attribute+']')
        for (let binding of bindings) {
            binding.dataset.bind = path+'.'+index+'.'+binding.dataset.bind
        }
        clone.children[0].setAttribute(options.attribute+'-key',index)
        return clone
    }

    const render = (el, root) => {
        let template = el.querySelector('template')
        let length = 0
        throttledEffect(() => { // FIXME: throttledEffect runs once too much (extra time at the end)
			const path = getBindingPath(el)
            const value = getValueByPath(root, path)
            if (Array.isArray(value) && template) {
                let items = el.querySelectorAll(':scope > [data-bind-key]')
                // do single merge strategy for now, in future calculate optimal merge strategy from a number
                // now just do a delete if a key <= last key, insert if a key >= last key
                let lastKey = 0
                for (let item of items) {
                    if (item.dataset.bindKey>lastKey) {
                        // insert before
                        el.insertBefore(applyTemplate(path, template, value, lastKey), item)
                    } else if (item.dataset.bindKey<lastKey) {
                        // remove this
                        item.remove()
                    } else {
                        // check that all data-bind params start with current json path or a '#', otherwise replaceChild
                        let bindings = item.querySelectorAll(':scope :not([data-bind-key]) [data-bind]')
                        let needsReplacement = Array.from(bindings).find(b => b.dataset.bind.substr(0, path.length)!==path)
                        if (needsReplacement) {
                            el.replaceChild(item, applyTemplate(path, template, value, lastKey))
                        }
                    }
                    lastKey++
                    if (lastKey>=value.length) {
                        break
                    }
                }
                items = el.querySelectorAll(':scope > [data-bind-key]')
                let length = items.length
                if (length > value.length) {
                    while (length > value.length) {
                        let child = el.querySelector(':scope > :nth-child('+(length+1)+')') //FIXME: assumes 1 template element
                        child?.remove()
                        length--
                    }
                } else if (length < value.length ) {
                    while (length < value.length) {
                        el.appendChild(applyTemplate(path, template, value, length))
                        length++
                    }
                }
            } else if (el.tagName=='INPUT') {
                if (el.type=='checkbox' || el.type=='radio') {
                    if (el.value == ''+value) {
                        el.checked = true
                    } else {
                        el.checked = false
                    }
                } else if (el.value != ''+value) {
                    el.value = ''+value
                }
            } else if (el.tagName=='BUTTON') {
                if (el.value!=''+value) {
                    el.value = ''+value
                }
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
                if (el.innerHTML != ''+value) {
                    el.innerHTML = ''+value
                }
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

function getValueByPath(root, path)
{
    let parts = path.split('.');
    let curr = root;
    let part, prevPart;
    while (parts.length && curr) {
        part = parts.shift()
        part = decodeURIComponent(part)
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
