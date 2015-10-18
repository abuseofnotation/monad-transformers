var sonne = require('../lib/main')
var sinon = require('sinon')

var maybeID = sonne.make(sonne.data.maybe, sonne.data.id)
const IDMaybe = sonne.make(sonne.data.id, sonne.data.maybe)
var maybeStacks = [IDMaybe, maybeID]

var monads = maybeStacks 

module.exports = {
    Maybe (test) {
      maybeStacks.forEach((maybe) =>{
        var spy = sinon.spy((a) => a)
        maybe.of(4)
          .map(function (val) {return val + 1})
          .chainMaybe((val)=> {
            test.equals(val, 5, 'A call to "map" modifies the value, and packs it again')
            return {maybeVal:undefined}
          })
        .map(spy)
        test.equals(spy.called, false, "After a val is set to undefined, functions are no longer called")

        debugger
        maybe.of({foo:"bar"})
          .get("foo")
          .map(spy)
        test.equals(spy.called, true)

      })
      test.done()
    },
    chain (test){
      const val = 5
      monads.forEach(monad => {
        var spy = sinon.spy((a) => a)
        monad.of(val)
          .chain((val)=> monad.of(val))
          .map(spy)	    
        test.equals(spy.firstCall.returnValue, val, "Unpacking a monad and packing it again yeilds the same structure")
        test.throws(()=>(monad.of(4).chain((val)=>monad.of(val)._value )), "The chain method expects a wrapped value")
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
