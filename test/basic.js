var sonne = require('../lib/main')
var sinon = require('sinon')
module.exports = {
  maybeId:{
    setUp:function(done){
      this.maybeId = sonne.make(sonne.data.maybe, sonne.data.id)
      this.spy = sinon.spy((a) => a)
      done()
    },
    map:function (test) {
      maybeId = this.maybeId

      this.maybeId(4)
        .map(function (val) {return val + 1})
        .map(function (a) {test.equals(a, 5, a);return a})
        .map(function (num) {return undefined})
        .map(this.spy)
      test.equals(this.spy.called, false)
      test.done()
    },
    flatMap:function(test){ 
      this.maybeId(4)
        .flatMap(function (val) {
          return maybeId(5)
        })
        .map(this.spy)
      test.equals(this.spy.firstCall.returnValue, 5)
      test.done()
    }
  }
}
