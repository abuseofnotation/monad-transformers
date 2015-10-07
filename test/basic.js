var sonne = require('../lib/main')
module.exports = {
  
  maybeId:function(test){
  
	var maybeId = sonne.make(sonne.data.maybe, sonne.data.id)

	maybeId(4)
	    .map(function(val){return val+1})
	    .map(function(a){test.equals(a, 5, a);return a})
	    .map(function(num){return undefined})
	    .map(function(a){test.equals(true, false);return a})

	var run = false
	maybeId(4)
	    .flatMap(function(val){
		return maybeId(5)
	    })
	    .map(function(val){
		test.equals(val, 5)
		run = true
	    })
	test.equals(run, true)

	test.done()


  }

}
