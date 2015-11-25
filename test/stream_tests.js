if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var sonne = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

const publishOneTwo = (publish) => {
  publish(1)
  setTimeout(() => publish(2), 10)
}

exports.stream = permutations(a => (a.indexOf(sonne.comp.stream) !== -1 ), (one, two, three) => {
  return {
    run:(test) => {
      const spy = sinon.spy((a) => a)
      const fstream = sonne.make(one, two, three)
      fstream.fromPublisher(publishOneTwo)
        .run(spy)
      setTimeout(() => {
        test.deepEqual(spy.returnValues, [1,2])
        test.done()
      }, 20)
    },
    map:(test) => {
      const spy = sinon.spy((a) => a)
      const fstream = sonne.make(one, two, three)
      fstream.fromPublisher(publishOneTwo)
        .map(a => a+1)
        .run(spy)
      setTimeout(() => {
        test.deepEqual(spy.returnValues, [2,3])
        test.done()
      }, 20)
    }
  }
})

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
