var sonne = require('../lib/main')
var sinon = require('sinon')

var maybeID = sonne.make(sonne.data.maybe, sonne.data.id)
const IDMaybe = sonne.make(sonne.data.id, sonne.data.maybe)
var maybeStacks = [IDMaybe, maybeID]

var maybeState = sonne.make(sonne.data.maybe, sonne.comp.state)
var stateMaybe = sonne.make(sonne.comp.state, sonne.data.maybe)
var stateStacks = [maybeState, stateMaybe]

var maybeList = sonne.make(sonne.data.maybe, sonne.data.list)
var listMaybe = sonne.make(sonne.data.list, sonne.data.maybe)
var listStacks = [maybeList, listMaybe]

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

        spy = sinon.spy((a) => a)
        maybe.of({foo:{baz:"bar"}})
          .get("foo")
          .get("baz")
          .map(spy)
        test.equals(spy.lastCall.returnValue, 'bar')

        spy = sinon.spy((a) => a)
        maybe.of({foo:"bar"})
          .get("bar")
          .map(spy)
        test.equals(spy.called, false, 'When you get an undefined value, maybe is not called ')
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
    /*List (test){
      maybeID
      listMaybe
      test.deepEqual(maybeList.of([1,2,3]).map((a)=>(a+1)), maybeList.of([2,3,4]), "foo")
      debugger
      listStacks.forEach((list) =>{
        list.of([1,2,3])
      })
      test.done()
    },*/
    state(test){
      maybeState
      stateMaybe

      maybeState( (prevState) => ({maybeVal:[4, undefined ] }) )
      stateMaybe( (prevState) => ([{maybeVal:4}, undefined ] ) )
        .save()
        ._value()

    /*  stateStacks.forEach(state => {
        state.of(4)
          .save()
          .load()
          .map(()=>6)
          .load()
          debugger
      })*/
      test.done()
    }

  }
