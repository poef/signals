import { throttledEffect } from './signals.mjs'

class SimplyBind {
    constructor(options) {
        const defaultOptions = {
            container: document.body,
            attribute: 'data-bind',
            transformers: [],
            defaultTransformers: [defaultTransformer]
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
                context.element = el
                runTransformers(context)
            }, 100)
        }

        const runTransformers = (context) => {
            let transformers = this.options.defaultTransformers || []
            if (context.element.dataset.transform) {
                context.element.dataset.transform.split(' ').filter(Boolean).forEach(t => {
                    if (this.options.transformers[t]) {
                        transformers.push(this.options.transformers[t])
                    } else {
                        console.warn('No transformer with name '+t+' configured', {cause:context.element})
                    }
                })
            }
            let next
            for (let transformer of transformers) {
                next = ((next, transformer) => {
                    return (context) => {
                        return transformer.call(this, context, next)
                    }
                })(next, transformer)
            }
            return next(context)
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
        const attribute = this.options.attribute
        for (let binding of bindings) {
            const bind = binding.getAttribute(attribute)
            if (bind.substring(0, '#root.'.length)=='#root.') {
                binding.setAttribute(attribute, bind.substring('#root.'.length))
            } else if (bind=='#value') {
                binding.setAttribute(attribute, path+'.'+index)
            } else {
                binding.setAttribute(attribute, path+'.'+index+'.'+bind)
            }
        }
        clone.children[0].setAttribute(attribute+'-key',index)
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
export function defaultTransformer(context) {
    const el = context.element
    const templates = context.templates
    const templatesCount = templates.length 
    const path = context.path
    const value = context.value
    const attribute = this.options.attribute
    if (Array.isArray(value) && templates?.length) {
        let items = el.querySelectorAll(':scope > ['+attribute+'-key]')
        // do single merge strategy for now, in future calculate optimal merge strategy from a number
        // now just do a delete if a key <= last key, insert if a key >= last key
        let lastKey = 0
        let skipped = 0
        for (let item of items) {
            let currentKey = parseInt(item.getAttribute(attribute+'-key'))
            if (currentKey>lastKey) {
                // insert before
                el.insertBefore(this.applyTemplate(path, templates, value, lastKey), item)
            } else if (currentKey<lastKey) {
                // remove this
                item.remove()
            } else {
                // check that all data-bind params start with current json path or a '#', otherwise replaceChild
                let bindings = Array.from(item.querySelectorAll(`[${attribute}]`))
                if (item.matches(`[${attribute}]`)) {
                    bindings.unshift(item)
                }
                let needsReplacement = bindings.find(b => {
                    let databind = b.getAttribute(attribute)
                    return (databind.substr(0,5)!=='#root' 
                        && databind.substr(0, path.length)!==path)
                })
                if (!needsReplacement) {
                    if (item.bindTemplate) {
                        let newTemplate = this.findTemplate(templates, value[lastKey])
                        if (newTemplate != item.bindTemplate){
                            needsReplacement = true
                            if (!newTemplate) {
                                skipped++
                            }
                        }
                    }
                }
                if (needsReplacement) {
                    el.replaceChild(this.applyTemplate(path, templates, value, lastKey), item)
                }
            }
            lastKey++
            if (lastKey>=value.length) {
                break
            }
        }
        items = el.querySelectorAll(':scope > ['+attribute+'-key]')
        let length = items.length + skipped
        if (length > value.length) {
            while (length > value.length) {
                let child = el.querySelectorAll(':scope > :not(template)')?.[length-1]
                child?.remove()
                length--
            }
        } else if (length < value.length ) {
            while (length < value.length) {
                el.appendChild(this.applyTemplate(path, templates, value, length))
                length++
            }
        }
    } else if (value && typeof value == 'object' && templates?.length) {
        let list    = Object.entries(value)
        let items   = el.querySelectorAll(':scope > ['+attribute+'-key]')
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
            const databind = item.getAttribute(attribute)
            if (databind && databind.substr(0, keypath.length)!=keypath) {
                needsReplacement=true
            } else {
                let bindings = Array.from(item.querySelectorAll(`[${attribute}]`))
                needsReplacement = bindings.find(b => {
                    const db = b.getAttribute(attribute)
                    return (db.substr(0,5)!=='#root' && db.substr(0, keypath.length)!==keypath)
                })
                if (!needsReplacement) {
                    if (item.bindTemplate) {
                        let newTemplate = this.findTemplate(templates, value[key])
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
                let clone = this.applyTemplate(path, templates, value, key)
                el.replaceChild(clone, item)
            }
        }
        items  = el.querySelectorAll(':scope > ['+attribute+'-key]')
        let length = items.length + skipped
        if (length>list.length) {
            while (length>list.length) {
                let child = el.querySelectorAll(':scope > :not(template)')?.[length-1]
                child?.remove()
                length--
            }
        } else if (length < list.length) {
            while (length < list.length) {
                let key = list[length][0]
                el.appendChild(this.applyTemplate(path, templates, value, key))
                length++
            }
        }
    } else if (el.tagName=='INPUT') {
        if (el.type=='checkbox' || el.type=='radio') {
            if (matchValue(el.value, value)) {
                el.checked = true
            } else {
                el.checked = false
            }
        } else if (!matchValue(el.value, value)) {
            el.value = ''+value
        }
    } else if (el.tagName=='BUTTON') {
        if (!matchValue(el.value,value)) {
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
            let option = el.options.find(o => matchValue(o.value,value))
            if (option) {
                option.selected = true
            }
        }
    } else if (el.tagName=='A') {
        if (value?.innerHTML && !matchValue(el.innerHTML, value.innerHTML)) {
            el.innerHTML = ''+value.innerHTML
        }
        if (value?.href && !matchValue(el.href,value.href)) {
            el.href = ''+value.href
        }
    } else {
        if (!matchValue(el.innerHTML, value)) {
            el.innerHTML = ''+value
        }
    }
}

