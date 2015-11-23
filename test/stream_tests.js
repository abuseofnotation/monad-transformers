if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var sonne = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

exports.list = permutations(a => (a.indexOf(sonne.comp.stream) !== -1 ), (one, two, three) => {
  const fstream = sonne.make(one, two, three)
}

/*
exports.basic = (test) => {
  var fstream = sonne.make(sonne.comp.stream, sonne.id.id)
  const st = fstream.of(4)
  st2 = st.map(a => a+1)._value(a=> console.log(a))

  var addItem
  fstream.fromStream(add =>{addItem = add})
    .map(a =>{console.log('added item '+a)})
    .run()
  addItem(2)
  
  fstream.fromStream(add =>{addItem = add})
    .chain(val => fstream.fromStream(add=> {
        add(val) 
        add(val+1)
      })
    )
    .map(a =>{console.log('added item '+a)})
    .run()
  addItem(2)
}
*/
