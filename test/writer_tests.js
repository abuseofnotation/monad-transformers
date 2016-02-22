
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var mtl = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

exports.writer = permutations(a => (a.indexOf(mtl.data.writer) !== -1), (one, two, three) => {
  return {
    tellListen: (test) => {
      
      const writer = mtl.make(one, two, three)
      writer.of(5)
        .tell('foo')
        .tell('bar')
        .value({ 
          onWriterLog: (val) =>{
            test.equal(val, 'foobar')
            test.done()
          }
        })

    }
  }
})
