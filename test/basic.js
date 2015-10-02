var sonne = require('../lib/core')
module.exports = {
  
  maybe_id:function(test){
  
	var maybe_id = sonne.make(sonne.data.maybe, sonne.data.id)

	maybe_id(4)
	    .map(function(val){return val+1})
	    .map(function(a){test.equals(a, 5, a);return a})
	    .map(function(num){return undefined})
	    .map(function(a){test.equals(true, false);return a})
	test.done()

  }

}
