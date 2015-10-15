var sonne = require('../lib/main')
var sinon = require('sinon')

var maybeStacks = [sonne.make(sonne.data.id, sonne.data.maybe), sonne.make(sonne.data.maybe, sonne.data.id)]

var monads = [sonne.make(sonne.data.id, sonne.data.maybe), sonne.make(sonne.data.maybe, sonne.data.id)]

module.exports = {
    Maybe (test) {
      maybeStacks.forEach((maybe) =>{
        var spy = sinon.spy((a) => a)
        var chainSpy = sinon.spy((a) => a)
        maybe(4)
          .map(function (val) {return val + 1})
          .chainMaybe((val)=> {
            test.equals(val, 5, 'A call to "map" modifies the value, and packs it again')
            return {maybeVal:undefined}
          })
        .map(spy)
        test.equals(spy.called, false, "After a val is set to undefined, functions are no longer called")
      })
      test.done()
    },
    chain (test){
      const val = 5
      monads.forEach(monad => {
        var spy = sinon.spy((a) => a)
        monad(val)
         .chain((val)=> monad(val))
         .chain((val)=> monad(val)._value)
      .map(spy)	    
        test.equals(spy.firstCall.returnValue, val, "Unpacking a monad and packing it again yeilds the same structure")
      }) 
      test.done()
    },
    maybeList (test){
      var maybeList = sonne.make(sonne.data.maybe, sonne.data.list)
      test.done()
    },
    test (test){
      debugger
      test.done()
    }

  }
