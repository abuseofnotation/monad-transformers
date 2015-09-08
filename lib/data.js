
exports.id = {
	name:"id",
    of: function(val){ return {idVal:val } },:w
	map: function(funk, val){
        return {
        	idVal:funk (val.idVal)
        }
    },
    flatMap: function(funk, val, innerMonad){
        return {
        	idVal:innerMonad.flatMap(function(innerId){
                return funk(innerId.idVal)
        	}, val.idVal)
        }
    },
    flat: function(val, innerMonad){
        var newId = innerMonad.map(function(innerId){
                return innerId.idVal
        }, val.idVal)
        return { idVal:newId }
    }
}

exports.maybe = {
	name:"id",
    of: function(val){ return {idVal:val } },:w
	map: function(funk, val){
        return {
        	idVal:funk (val.idVal)
        }
    },
    flatMap: function(funk, val, innerMonad){
        return {
        	idVal:innerMonad.flatMap(function(innerId){
                return funk(innerId.idVal)
        	}, val.idVal)
        }
    },
    flat: function(val, innerMonad){
        var newId = innerMonad.map(function(innerId){
                return innerId.idVal
        }, val.idVal)
        return { idVal:newId }
    }
}

