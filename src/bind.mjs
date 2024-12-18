import { throttledEffect } from './signals.mjs'

export function bind(options)
{
    const defaultOptions = {
        container: document.body,
        attribute: 'data-bind',
        transformers: []
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
                        let bindings = Array.from(node.querySelectorAll(`[${options.attribute}]`))
                        if (node.matches(`[${options.attribute}]`)) {
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

    const handleChanges = (changes) => {
        updateBindings(changes)
    }

    const observer = new MutationObserver((changes) => {
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

    function applyTemplate(path, templates, list, index) {
        let template = findTemplate(templates, list[index], options.root)
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
        const bindings = clone.querySelectorAll('['+options.attribute+']')
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
        clone.children[0].setAttribute(options.attribute+'-key',index)
        clone.children[0].bindTemplate = template
        return clone
    }

    const render = (el, root) => {
        throttledEffect(() => {
            const templates = el.querySelectorAll(':scope > template')
            const path = getBindingPath(el)
            const value = getValueByPath(root, path)
            const transformOptions = Object.assign({}, options, {templates, path, value})
            if (!el.dataset.transform || !options.transformers[el.dataset.transform]) {
                return defaultTransformer.call(el, transformOptions, applyTemplate)
            }
            return options.transformers[el.dataset.transform]
                .call(el, transformOptions, applyTemplate)
        }, 100)
    }
    
    const getBindingPath = (el) => {
        return el.getAttribute(options.attribute)
    }

    const bindings = options.container.querySelectorAll('['+options.attribute+']:not(template)')
    if (bindings.length) {
        applyBindings(bindings)
    }
}

export function defaultTransformer(options, applyTemplate) {
    const templates = options.templates
    const templatesCount = templates.length 
    const path = options.path
    const value = options.value
    applyTemplate = applyTemplate.bind(this)
    if (Array.isArray(value) && templates?.length) {
        let items = this.querySelectorAll(':scope > ['+options.attribute+'-key]')
        // do single merge strategy for now, in future calculate optimal merge strategy from a number
        // now just do a delete if a key <= last key, insert if a key >= last key
        let lastKey = 0
        let skipped = 0
        for (let item of items) {
            if (item.dataset.bindKey>lastKey) {
                // insert before
                this.insertBefore(applyTemplate(path, templates, value, lastKey), item)
            } else if (item.dataset.bindKey<lastKey) {
                // remove this
                item.remove()
            } else {
                // check that all data-bind params start with current json path or a '#', otherwise replaceChild
                let bindings = Array.from(item.querySelectorAll(`[${options.attribute}]`))
                if (item.matches(`[${options.attribute}]`)) {
                    bindings.unshift(item)
                }
                let needsReplacement = bindings.find(b => {
                    return (b.dataset.bind.substr(0,5)!=='#root' 
                        && b.dataset.bind.substr(0, path.length)!==path)
                })
                if (!needsReplacement) {
                    if (item.bindTemplate) {
                        let newTemplate = findTemplate(templates, value[lastKey], options.root)
                        if (newTemplate != item.bindTemplate){
                            needsReplacement = true
                            if (!newTemplate) {
                                skipped++
                            }
                        }
                    }
                }
                if (needsReplacement) {
                    this.replaceChild(applyTemplate(path, templates, value, lastKey), item)
                }
            }
            lastKey++
            if (lastKey>=value.length) {
                break
            }
        }
        items = this.querySelectorAll(':scope > ['+options.attribute+'-key]')
        let length = items.length + skipped
        if (length > value.length) {
            while (length > value.length) {
                let child = this.querySelectorAll(':scope > :not(template)')?.[length-1]
                child?.remove()
                length--
            }
        } else if (length < value.length ) {
            while (length < value.length) {
                this.appendChild(applyTemplate(path, templates, value, length))
                length++
            }
        }
    } else if (value && typeof value == 'object' && templates?.length) {
        let list    = Object.entries(value)
        let items   = this.querySelectorAll(':scope > ['+options.attribute+'-key]')
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
                let bindings = Array.from(item.querySelectorAll(`[${options.attribute}]`))
                needsReplacement = bindings.find(b => {
                    return (b.dataset.bind.substr(0,5)!=='#root' && b.dataset.bind.substr(0, keypath.length)!==keypath)
                })
                if (!needsReplacement) {
                    if (item.bindTemplate) {
                        let newTemplate = findTemplate(templates, value[key], options.root)
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
                let clone = applyTemplate(path, templates, value, key)
                this.replaceChild(clone, item)
            }
        }
        items  = this.querySelectorAll(':scope > ['+options.attribute+'-key]')
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
                this.appendChild(applyTemplate(path, templates, value, key))
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

function matchValue(a,b) {
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
        } else if (part=='#root') {
            curr = root
        } else {
            curr = curr[part];
            prevPart = part
        }
    }
    return curr
}

function findTemplate(templates, value, root) {
    const templateMatches = t => {
        if (!t.dataset.bind) {
            return t
        }
        let currentItem
        if (t.dataset.bind.substr(0,5)=='#root') {
            currentItem = getValueByPath(root, t.dataset.bind)
        } else {
            currentItem = getValueByPath(value, t.dataset.bind)
        }
        const strItem = ''+currentItem
        if (t.dataset.bindMatches) {
            let matchTo = t.dataset.bindMatches
            if (matchTo[0]=='/') {
                matchTo = new Regexp(matchTo.split('/')[0],matchTo.split('/')[1])
            } else if (matchTo==='#empty' && !currentItem) {
                return t
            } else if (matchTo==='#notempty' && currentItem) {
                return t
            }
            if (strItem.match(matchTo)) {
                return t
            }
        }
        if (!t.dataset.bindMatches) {
            if (currentItem) {
                return t
            }
        }
    };
    let template = Array.from(templates).find(templateMatches)
    let rel = template.getAttribute('rel')
    if (rel) {
        let replacement = document.querySelector('template#'+rel)
        if (!replacement) {
            throw new Error('Could not find template with id '+rel)
        }
        template = replacement
    }
    return template
}