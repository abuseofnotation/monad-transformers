if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var sonne = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

const publishOneTwo = (publish) => {
  setTimeout(() => {console.log('published 1');publish(1)}, 1)
  setTimeout(() => {console.log('published 2');publish(2)}, 20)
}
const publishOneTwoSync = (publish) => {
  console.log('published 1');publish(1)
  console.log('published 2');publish(2)
}
const inArray = (arr, val) => arr.indexOf(val) !== -1

exports.stream = permutations(a => { 
    return a.indexOf(sonne.comp.stream) === 0
      //inArray(a, sonne.comp.stream)
     // && !inArray(a, sonne.comp.list)
     // && !inArray(a, sonne.data.maybe)
  }, (one, two, three) => {
  return {
    value:(test) => {
      const spy = sinon.spy((a) => a)
      const fstream = sonne.make(one, two, three)
      fstream.fromPublisher(publishOneTwoSync)
        .value(spy)
        test.deepEqual(spy.returnValues, [1,2])
        test.done()
    },
    chain:(test) => {
      const spy = sinon.spy((a) => a)
      const fstream = sonne.make(one, two, three)
      fstream.fromPublisher(publishOneTwo)
        .chain(() => fstream.fromPublisher(publishOneTwo))
        .value(spy)
      setTimeout(() => {
        test.deepEqual(spy.returnValues, [1,1,2,2])
        test.done()
      }, 100)
    },
    map:(test) => {
      const spy = sinon.spy((a) => a)
      const fstream = sonne.make(one, two, three)
      fstream.fromPublisher(publishOneTwo)
        .map(a => a+1)
        .value(spy)
      setTimeout(() => {
        test.deepEqual(spy.returnValues, [2,3])
        test.done()
      }, 100)
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
    .value()
  addItem(2)
  
  fstream.fromStream(add =>{addItem = add})
    .chain(val => fstream.fromStream(add=> {
        add(val) 
        add(val+1)
      })
    )
    .map(a =>{console.log('added item '+a)})
    .value()
  addItem(2)
}
*/
