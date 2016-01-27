const mtl = require("../lib/main.js")


if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}


const react = {
  name: 'React',
  of (val) {
    return this.outer.of(val)
  },
  chain (fn, val) {
    return this.outer.chain(fn, val)
  },
  lift (val) {
    return val
  },
  fold (value, val) {
    return value(val)
  },
  render(val) {
    debugger 
    return this.outer.of(val)
  }
}




const m = mtl.make(mtl.data.maybe, mtl.comp.state, react)

const immutable = require('immutable')

const val = m.of(immutable.List()).setState('')
const onUserAction = (a) => { val = val.chain(actions[a.type](a)); val.run() }

const checkNotEmpty = (val) => val !== "" ? m.of(val): m.nothing()

const textToNote = (text) => m.of(text).chain(checkNotEmpty).map((text) => ({text:text, done:false}))

const toggle = mtl.curry((index, val) => val.get())

const actions = {
  type: (text) => (val) => m.of(val).setState(text).render(),

  enter: (_) => (val) => m.of().loadState().chain(textToNote).map((newNote) => val.push(newNote)).setState(''),

  remove: (i) => (val) => m.of(val.remove(index)),

  toggle: (i) => (val) => m.of(toggle(i, val))
}

exports.todo = {
  one (test) {
    val
      .chain(actions.type('foo'))
      .chain(actions.enter())
      .run((val) => {
        test.equal(val.value.value.size, 1)
        test.equal(val.value.state, '')
        test.done()
      })
  },

  two (test) {
    val
      .chain(actions.type('foo'))
      .chain(actions.enter())
      .chain(actions.type('bar'))
      .run((val) => {
        test.equal(val.value.value.size, 1)
        test.equal(val.value.state, 'bar')
        test.done()
      })
  }
}

