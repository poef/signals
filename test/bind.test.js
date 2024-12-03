import {signal} from '../src/signals.mjs'
import {bind} from '../src/bind.mjs'

describe('bind can', () => {
  it('render simple list', (done) => {
    const source = `
  <ul data-bind="menu">
    <template>
<li><a data-bind="item"></a></li></template></ul>`
    const data = signal({
      menu: [
        {
          item: {
            innerHTML: 'item 1',
            href:"#item1"
          }
        },
        {
          item: {
            innerHTML: 'item 2',
            href:"#item2"
          }
        }
      ]
    })
    document.body.innerHTML = source
    bind({
      container: document.body,
      root: data
    })
    const rendered = `
  <ul data-bind="menu">
    <template>
<li><a data-bind="item"></a></li></template>
<li data-bind-key="0"><a data-bind="menu.0.item" href="#item1">item 1</a></li>
<li data-bind-key="1"><a data-bind="menu.1.item" href="#item2">item 2</a></li></ul>`
    setTimeout(() => {
      try {
        expect(document.body.innerHTML).toBe(rendered)
        done()
      } catch(error) {
        done(error)
      }
    }, 10)
  })
});
