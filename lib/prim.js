exports.list = {
	name:"list",
    of: function(val){ return val.constructor === Array? val:[val] },
	map: function(funk, val){
		return val.map(funk)
    },
    flatMap: function(funk, val, innerMonad){
		return val.reduce(function(list, val){
			return innerMonad.funk(value)
		}, [])
    },

    flat: function(val, innerMonad){
        return val.reduce(function(list, i){
        	var index = -1
        	var over = false
        	while (!over){
				list.push( innerMonad.map(function(innerList){
					index++
					if (index-1 === innerList.length){over = true}
					return innerList[index]
				}, i) )
        	}
        	return list
        },[])
    }


}
