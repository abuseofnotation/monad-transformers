if ( global.v8debug ) {
  global.v8debug.Debug.setBreakOnException(); // speaks for itself
}
var sonne = require('../lib/main')
var sinon = require('sinon')


var maybeState = sonne.make(sonne.data.maybe, sonne.comp.state)
var stateMaybe = sonne.make(sonne.comp.state, sonne.data.maybe)
var stateStacks = [maybeState, stateMaybe]

var maybeStacks = [/*maybeState*/, stateMaybe]
var maybeList = sonne.make(sonne.data.maybe, sonne.comp.list)
var listMaybe = sonne.make(sonne.comp.list, sonne.data.maybe)
var listStacks = [maybeList, listMaybe]

var monads = maybeStacks

module.exports = {
    Maybe (test) {
      test.expect(maybeStacks.length *4)
      maybeStacks.forEach((maybe) =>{
        var spy = sinon.spy((a) => a)
        maybe.of(4)
          .map(function (val) {return val + 1})
          .chainMaybe((val)=> {
            test.equals(val, 5, 'A call to "map" modifies the value, and packs it again')
            return {maybeVal:undefined} 
          })
          .map(spy)
          //.run()
        test.equals(spy.called, false, "After a val is set to undefined, functions are no longer called")

        spy = sinon.spy((a) => a)
        var m = maybe.of({foo:{baz:"bar"}})
          .get("foo")
          .get("baz")
          .map(spy)
          .run()
        test.equals(spy.lastCall.returnValue, 'bar')

        spy = sinon.spy((a) => a)
        maybe.of({foo:"bar"})
          .get("bar")
          .map(spy)
          .run()
        test.equals(spy.called, false, 'When you get an undefined value, maybe is not called ')
      })
      test.done()
    },
    List (test){
      var spy = sinon.spy((a) => a)
      listMaybe.lift(sonne.comp.list, [{name:"foo"},{name:"bar"}, {name:"baz"}])
        .get("name")
        .map(spy)

      test.deepEqual(spy.returnValues, ['foo', 'bar', 'baz'])

      listStacks.forEach((list) =>{
      })
      test.done()
    },
    state(test){
        test.expect(stateStacks.length * 3)
        stateStacks.forEach(state => {
        state.of(4)
          
          .save()
          .map((val)=> {
            test.equal(val, 4, '"save" does not affect the wrapped value')
            return 6
          })
        
          .map((val)=> {
            test.equal(val, 6, '"map" replaces the wrapped value')
            return val
          })
          .load()
          .map((val)=>{
            test.equal(val, 4, '"load" brings back the saved value')
            return val
          }) 

          ._value()
          debugger
      })
      test.done()
    }


  }
