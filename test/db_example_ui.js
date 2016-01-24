const mtl = require("../lib/main.js")


if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
//const m = mtl.advanced

const m = mtl.make(mtl.data.maybe, mtl.comp.state)

const immutable = require('immutable')

const val = m.of('').mapState( () =>[immutable.List(),  ""])
const onUserAction = (a) => { val = val.andThen(actions[a.type](a)); val.run() }

const checkNotEmpty = (val) => val !== "" ? m.of(val): m.nothing()

const textToNote = (text) => m.of(text).chain(checkNotEmpty).map((text) => ({text:text, done:false}))
//.andThen(m.of({ text:text, done:false})

const actions = {
  type: (text) => m.of(text).mapState((state, text) => [state[0], text]),
  enter: (_) => m.of('').loadState()
    .chain((state) => m.of(state[1]).chain(textToNote).debug().map((newNote) => [state[0].push(newNote), ''])).saveState(),
  remove: (i) => m.of(i).mapState((state, index) => [state[0].remove(index), text]),
  toggle: a=>a
}



exports.todo = (test) => {
  const a = val.andThen(actions.type('foo')).andThen(actions.enter()).run((val) => {debugger; test.done()})

}

