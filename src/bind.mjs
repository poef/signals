import { throttledEffect } from './signals.mjs'

class SimplyBind {
    constructor(options) {
        const defaultOptions = {
            container: document.body,
            attribute: 'data-bind',
            transformers: []
        }
        if (!options?.root) {
            throw new Error('bind needs at least options.root set')
        }
        this.options = Object.assign({}, defaultOptions, options)

        const attribute = this.options.attribute

        const render = (el) => {
            throttledEffect(() => {
                const context = {
                    templates: el.querySelectorAll(':scope > template'),
                    path: this.getBindingPath(el)
                }
                context.value = getValueByPath(this.options.root, context.path)
                if (!el.dataset.transform || !this.options.transformers[el.dataset.transform]) {
                    return defaultTransformer.call(el, this, context)
                }
                return this.options.transformers[el.dataset.transform]
                    .call(el, this, context)
            }, 100)
        }

        const applyBindings = (bindings) => {
            for (let bindingEl of bindings) {
                render(bindingEl)
            }
        }

        const updateBindings = (changes) => {
            for (const change of changes) {
                if (change.type=="childList" && change.addedNodes) {
                    for (let node of change.addedNodes) {
                        if (node instanceof HTMLElement) {
                            let bindings = Array.from(node.querySelectorAll(`[${attribute}]`))
                            if (node.matches(`[${attribute}]`)) {
                                bindings.unshift(node)
                            }
                            if (bindings.length) {
                                applyBindings(bindings)
                            }
                        }
                    }
                }
            }
        }

        const observer = new MutationObserver((changes) => {
            updateBindings(changes)
        })

        observer.observe(options.container, {
            subtree: true,
            childList: true
        })

        const bindings = this.options.container.querySelectorAll('['+this.options.attribute+']:not(template)')
        if (bindings.length) {
            applyBindings(bindings)
        }

    }

    applyTemplate(path, templates, list, index) {
        let template = this.findTemplate(templates, list[index])
        if (!template) {
            let result = new DocumentFragment()
            result.innerHTML = '<!-- no matching template -->'
            return result
        }
        let clone = template.content.cloneNode(true)
        if (!clone.children?.length) {
            throw new Error('template must contain a single html element', { cause: template })
        }
        if (clone.children.length>1) {
            throw new Error('template must contain a single root node', { cause: template })
        }
        const bindings = clone.querySelectorAll('['+this.options.attribute+']')
        for (let binding of bindings) {
            const bind = binding.dataset.bind
            if (bind.substring(0, '#root.'.length)=='#root.') {
                binding.dataset.bind = bind.substring('#root.'.length)
            } else if (bind=='#value') {
                binding.dataset.bind = path+'.'+index
            } else {
                binding.dataset.bind = path+'.'+index+'.'+binding.dataset.bind
            }
        }
        clone.children[0].setAttribute(this.options.attribute+'-key',index)
        clone.children[0].bindTemplate = template
        return clone
    }

    getBindingPath(el) {
        return el.getAttribute(this.options.attribute)
    }

    findTemplate(templates, value) {
        const templateMatches = t => {
            let path = this.getBindingPath(t)
            if (!path) {
                return t
            }
            let currentItem
            if (path.substr(0,6)=='#root.') {
                currentItem = getValueByPath(this.options.root, path)
            } else {
                currentItem = getValueByPath(value, path)
            }
            const strItem = ''+currentItem
            let matches = t.getAttribute(this.options.attribute+'-matches')
            if (matches) {
                if (matches==='#empty' && !currentItem) {
                    return t
                } else if (matches==='#notempty' && currentItem) {
                    return t
                }
                if (strItem.match(matches)) {
                    return t
                }
            }
            if (!matches) {
                if (currentItem) {
                    return t
                }
            }
        };
        let template = Array.from(templates).find(templateMatches)
        let rel = template?.getAttribute('rel')
        if (rel) {
            let replacement = document.querySelector('template#'+rel)
            if (!replacement) {
                throw new Error('Could not find template with id '+rel)
            }
            template = replacement
        }
        return template
    }

}

export function bind(options)
{
    return new SimplyBind(options)
}

export function matchValue(a,b) {
    if (a=='#empty' && !b) {
        return true
    }
    if (b=='#empty' && !a) {
        return true
    }
    if (''+a == ''+b) {
        return true
    }
    return false
}

export function getValueByPath(root, path)
{
    let parts = path.split('.');
    let curr = root;
    let part, prevPart;
    while (parts.length && curr) {
        part = parts.shift()
        if (part=='#key') {
            return prevPart
        } else if (part=='#value') {
            return curr
        } else if (part=='#root') {
            curr = root
        } else {
            part = decodeURIComponent(part)
            curr = curr[part];
            prevPart = part
        }
    }
    return curr
}



//FIXME: give default transformer access to options and applyTemplate without
//passing, so define it inside the bind() function
//then only pass data in and update the dom
//then add transformers with (data, next) as params, where defaultTransformer is the 
//last transformer in the chain
//problem: user defined transformers do not have access to the options and crucially
//the applyTemplate function
//replacing the defaultTransformer in a custom bind() implementation is also 
//impossible/difficult
export function defaultTransformer(bind, context) {
    const templates = context.templates
    const templatesCount = templates.length 
    const path = context.path
    const value = context.value
    const attribute = bind.options.attribute
    if (Array.isArray(value) && templates?.length) {
        let items = this.querySelectorAll(':scope > ['+attribute+'-key]')
        // do single merge strategy for now, in future calculate optimal merge strategy from a number
        // now just do a delete if a key <= last key, insert if a key >= last key
        let lastKey = 0
        let skipped = 0
        for (let item of items) {
            if (item.dataset.bindKey>lastKey) {
                // insert before
                this.insertBefore(bind.applyTemplate(path, templates, value, lastKey), item)
            } else if (item.dataset.bindKey<lastKey) {
                // remove this
                item.remove()
            } else {
                // check that all data-bind params start with current json path or a '#', otherwise replaceChild
                let bindings = Array.from(item.querySelectorAll(`[${attribute}]`))
                if (item.matches(`[${attribute}]`)) {
                    bindings.unshift(item)
                }
                let needsReplacement = bindings.find(b => {
                    return (b.dataset.bind.substr(0,5)!=='#root' 
                        && b.dataset.bind.substr(0, path.length)!==path)
                })
                if (!needsReplacement) {
                    if (item.bindTemplate) {
                        let newTemplate = bind.findTemplate(templates, value[lastKey])
                        if (newTemplate != item.bindTemplate){
                            needsReplacement = true
                            if (!newTemplate) {
                                skipped++
                            }
                        }
                    }
                }
                if (needsReplacement) {
                    this.replaceChild(bind.applyTemplate(path, templates, value, lastKey), item)
                }
            }
            lastKey++
            if (lastKey>=value.length) {
                break
            }
        }
        items = this.querySelectorAll(':scope > ['+attribute+'-key]')
        let length = items.length + skipped
        if (length > value.length) {
            while (length > value.length) {
                let child = this.querySelectorAll(':scope > :not(template)')?.[length-1]
                child?.remove()
                length--
            }
        } else if (length < value.length ) {
            while (length < value.length) {
                this.appendChild(bind.applyTemplate(path, templates, value, length))
                length++
            }
        }
    } else if (value && typeof value == 'object' && templates?.length) {
        let list    = Object.entries(value)
        let items   = this.querySelectorAll(':scope > ['+attribute+'-key]')
        let current = 0
        let skipped = 0
        for (let item of items) {
            if (current>=list.length) {
                break
            }
            let key = list[current][0]
            current++
            let keypath = path+'.'+key
            // check that all data-bind params start with current json path or a '#', otherwise replaceChild
            let needsReplacement
            if (item.dataset?.bind && item.dataset.bind.substr(0, keypath.length)!=keypath) {
                needsReplacement=true
            } else {
                let bindings = Array.from(item.querySelectorAll(`[${attribute}]`))
                needsReplacement = bindings.find(b => {
                    return (b.dataset.bind.substr(0,5)!=='#root' && b.dataset.bind.substr(0, keypath.length)!==keypath)
                })
                if (!needsReplacement) {
                    if (item.bindTemplate) {
                        let newTemplate = bind.findTemplate(templates, value[key])
                        if (newTemplate != item.bindTemplate){
                            needsReplacement = true
                            if (!newTemplate) {
                                skipped++
                            }
                        }
                    }
                }
            }
            if (needsReplacement) {
                let clone = bind.applyTemplate(path, templates, value, key)
                this.replaceChild(clone, item)
            }
        }
        items  = this.querySelectorAll(':scope > ['+attribute+'-key]')
        let length = items.length + skipped
        if (length>list.length) {
            while (length>list.length) {
                let child = this.querySelectorAll(':scope > :not(template)')?.[length-1]
                child?.remove()
                length--
            }
        } else if (length < list.length) {
            while (length < list.length) {
                let key = list[length][0]
                this.appendChild(bind.applyTemplate(path, templates, value, key))
                length++
            }
        }
    } else if (this.tagName=='INPUT') {
        if (this.type=='checkbox' || this.type=='radio') {
            if (matchValue(this.value, value)) {
                this.checked = true
            } else {
                this.checked = false
            }
        } else if (!matchValue(this.value, value)) {
            this.value = ''+value
        }
    } else if (this.tagName=='BUTTON') {
        if (!matchValue(this.value,value)) {
            this.value = ''+value
        }
    } else if (this.tagName=='SELECT') {
        if (this.multiple) {
            if (Array.isArray(value)) {
                for (let option of this.options) {
                    if (value.indexOf(option.value)===false) {
                        option.selected = false
                    } else {
                        option.selected = true
                    }
                }
            }
        } else {
            let option = this.options.find(o => matchValue(o.value,value))
            if (option) {
                option.selected = true
            }
        }
    } else if (this.tagName=='A') {
        if (value?.innerHTML && !matchValue(this.innerHTML, value.innerHTML)) {
            this.innerHTML = ''+value.innerHTML
        }
        if (value?.href && !matchValue(this.href,value.href)) {
            this.href = ''+value.href
        }
    } else {
        if (!matchValue(this.innerHTML, value)) {
            this.innerHTML = ''+value
        }
    }
}

