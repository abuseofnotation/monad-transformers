
/* 
 * # Example Part 4 - Dynamic apps
 *
 * _Creating custom monads 2. Dynamic IO_
 *
 * Ahh, the TODO app. How many frameworks were demonstrated with it. It may seem like a cliche, but it is helpful.
 * So how to go with it?
 */

/*
 * Most of the applications that we write are dynamic - they constantly receive input and output.
 * 
 * Such applications cannot be purely functional, that is they must feature an imperative core that takes care 
 * of rendering and interactivity. 
 *
 * Our job is to model the application such that this core is trivial. Monads are NOT used to 
 * model the imperative part - they are used to model the rest of the application.
 *
 * Assume that we have a function that get's called for every user action (a kind of universal event handler):
 * 
 * Then we can use the following as out imperative core:
 */
const mtl = require("../lib/main.js")

if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
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


