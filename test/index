
var maybe_id = make_monad(maybe, id)

maybe_id(4)
    .map(function(val){return val+1})
    .map(function(a){console.assert(a === 5, a);return a})
    .map(function(num){return undefined})
    .map(function(a){console.assert(false);return a})



list_maybe = make_monad(list, maybe)
list_maybe([4,2])
	.flatMap(function(a){return list_maybe([a,a+1])})
	.map(function(val){
		console.log(val)
	})


run = false
maybe_id(4)
    .flatMap(function(val){
        return maybe_id(5)
    })
    .map(function(val){
        console.assert(val===5)
        run = true
    })
console.assert(run === true)



var maybe_promise = make_monad(maybe, promise)

run = false
maybe_promise(4)
.map(function(val){return val+1})
.map(function(val){
	console.assert(val, 5);
	run = true
	return val
})
._value( function(){})
console.assert(run === true)



val = maybe_promise(4)
    .map(function(val){return maybe_promise(5)})

run = false
maybe_promise(4)
    .flatMap(function(val){return maybe_promise(5)})
    .map(function(val){
        run = true;
        console.assert(val, 5)
        return val
    })
    ._value( function(){})
console.assert(run === true)

maybe_promise(4)

.flatMap(function(val){
	return maybe_promise(function(resolve){setTimeout(function(){resolve(val+1) }, 1000) })
})
.map(print)
._value(function(){})
