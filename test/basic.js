var sonne = require('../lib/main')
var sinon = require('sinon')
module.exports = {
    maybeId:function (test) {
      var maybeId = sonne.make(sonne.data.maybe, sonne.data.id)
      var mapSpy = sinon.spy((a) => a)
      var flatMapSpy = sinon.spy((a) => a)
      
      
      maybeId(4)
        .map(function (val) {return val + 1})
        .liftMaybe((val)=> {
          test.equals(val, 5, 'A call to "map" modifies the value, and packs it again')
          return {maybeVal:undefined}
	})
        .map(mapSpy)
      test.equals(mapSpy.called, false, "After a val is set to undefined, functions are no longer called")

      maybeId(4)
        .flatMap(function (val) {
          return maybeId(5)
        })
        .map(flatMapSpy)
      test.equals(flatMapSpy.firstCall.returnValue, 5)

      test.done()
    },
    
    idMaybe:function(test){ 
      var idMaybe = sonne.make(sonne.data.id, sonne.data.maybe)
      var mapSpy = sinon.spy((a) => a)
      var flatMapSpy = sinon.spy((a) => a)
      idMaybe(4).flatMap(()=>{maybeVal:undefined})
      debugger
      idMaybe(4)
        .map(function (val) {return val + 1})
        .liftMaybe((val) => {
          test.equals(val, 5, 'A call to "map" modifies the value, and packs it again')
          return {maybeVal:undefined}
	})
        .map(mapSpy)
      test.equals(mapSpy.called, false, "After a val is set to undefined, functions are no longer called")
      test.done()
    }

   /* maybeList:{
      setUp:function(done){
        this.maybeList = sonne.make(sonne.data.maybe, sonne.data.list)
        this.spy = sinon.spy((a) => a)
        done()
      },
      flatMap:function(test){
        this.maybeList([1,2,3])
      }
      
    }*/
  }
