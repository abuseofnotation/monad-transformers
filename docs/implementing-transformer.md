# Implementing a monad transformer 

Monad transformers are tricky, and one of the reasons for this is that they require an excessive amount of type juggling. You have to constantly wrap things in boxes and unwrap them again.  

One of the aims of this package is to reduce the amount of wrapping and unwrapping needed for making a new transformer and to provide an easy way to define and combine transformers.  

With it, all it takes to implement a transformer is implement these four functions:  `of` (AKA `return`), `chain` (AKA `flatMap`) `lift` and `value`(AKA `run`) 

## The trivial implementation 

Consider the identity Monad transformer. This is a monad transformer that does nothing:  or in other words it produces a monad which behaves the same way as the one it is given to it as an argument. Here is how would the implementation of these methods look like: 

    
    exports.idMinimal = {
      name: 'idMinimal',


The `of` function takes a scalar value and returns an instance of the outer monad. In this case we delegate everything to the outer monad's `of` method. We access the outer monad with `this.outer`.  

      // (val) => M(val)
      of (val) {
        return this.outer.of(val)
      },


`chain` is the heart of any monad or monad transformer. 

In this case we implement it by just calling the `chain` function of the host monad (using  `this.outer.chain`) with the function given to us as an argument. 

      // (val => M(val) , M(val)) => M(val)
      chain (fn, val) {
        return this.outer.chain(fn, val)
      },


The `lift` function is kinda like `of`, but it accepts an instance of the outer monad instead of a 'plain' value. 

      // (M(val)) => M(val)
      lift (val) {
        return val
      },


Having both 'lift' and 'of' enables us to convert any value created by one monad transformer to a a value that holds all elements of the stack 

Finally the `value` function provides a way to get 'the value back' What it does is to unwrap a previously-wrapped monad. In this case we didn't do any wrapping, so we don't have to do any unwrapping either. 

      // ((val) => otherVal, M(val)) => otherVal
      value (fn, val) {
        return this.outer.value(fn, val)
      }
    }
    
# Manipulating the value 

All monad transformers do the same thing (given a monad `A`, they produce a monad `B(A)` which somehow augments `A`), but there is no general formula for doing it. 

Simpler monads can be implemented just by manipulating the value inside the host monad. 

Our next implementation of ID will just wrap the underlying value (which we called A) in a plain object. 

So `M(A)` would become `M ({idVal:A})` when we wrap it and will be back to `M(A)` when we unwrap it. 

Here is how this implementation would look like: 

    
    exports.id = {
      name: 'Id',
    


The `of` function takes a scalar value and returns an instance of the outer monad. In this case we delegate everything to the outer monad's `of` method. We access the outer monad with `this.outer`.  

    
      // (val) => M({idVal:val})
      of (val) {
        return this.outer.of({idVal: val })
      },




chain just calls the `chain` function of the host monad like in the previous example. The difference is that it applies some transformation to the value in order to fit  the new context.  

      // (val => M({idVal:val}) , M({idVal:val})) => M({idVal:val})
      chain (fn, mIdVal) {
        return this.outer.chain((idVal) => {
          return fn(idVal.idVal)
        }, mIdVal)
      },


The `lift` function uses `chain` + `of` (which is the same as `map`) to go to the host monad and modify the value inside it. 

      // (M(val)) => M({idVal:val})
      lift (mVal) {
        return this.outer.chain((val) => this.outer.of({idVal: val}), mVal)
      },


Lastly we have the `value` function (or the interpreter), which unwraps a previously-wrapped value. 

      // ((val) => otherVal, M({idVal:val})) => otherVal
      value (fn, mIdVal) {
        return this.outer.value((idVal)=> {
          return fn(idVal.idVal)
        }, mIdVal)
      }
    }
    


Notice that we are always returning an instance of the outer monad. 

That is, if you are to apply the transformation several times, the values nest inside M: M({idVal:{idVal: a}}) 

However not all monad transformers are like that. 

## A more complex structure 

So far we have seen monad transformers which only deal with the value inside the given monad A. However not all monad transformers are like that.  

There are monad transformers which add additional structure to the monad itself. Examples of the first type are all transformers that we have seen so far. An example of the second type is the 'State' monad, which given the same value `M(A)`, will  produce something like `() =>{ M([A, State]) }`. That is, the transformer adds the state value to the 'host' monad `M`, and then it wraps the monad itself in a function. 

Now consider an alternative, a little more complex implementation of the ID monad. One which wraps the M monad into another plain object, so the value of M(A) becomes `{idContainer: M({idVal:a})}`. Notice that the transformer consists of two parts: one which  wraps around the host monad, and one which wraps around the value in it. 

    
    exports.idWrapped = {
      name: 'IdWrapped',
    
      // (val) => {idContainer: M({idVal:a})}
      of (val) {
        return {
          idContainer: this.outer.of({idVal: val})
        }
      },
    
      // (a => {idContainer:M({idVal:a})}, {idContainer:M({idVal:a})}) => {idContainer:M({idVal:a})}
      chain (fn, idContainerMIdVal) {
        return {
          idContainer: this.outer.chain((idVal) => {
            const val = fn(idVal.idVal)
            return val.idContainer
          }, idContainerMIdVal.idContainer)
        }
      },
    
      // (M(val)) => {idContainer:M({idVal:val})}
      lift (mVal) {
        return {
          idContainer: this.outer.chain((val) => this.outer.of({idVal: val}), mVal)
        }
      },
    
      // ((val) => otherVal, {idContainer: M({idVal:val}))}=> otherVal
      value (fn, idContainerMIdVal) {
        return this.outer.value((idVal)=> {
          return fn(idVal.idVal)
        }, idContainerMIdVal.idContainer)
      }
    }
    
The key difference is that with this monad nesting happens both inside the host monad and outside of it. If we apply the transformation two times the value becomes: `{idContainer:{idContainer:M({idVal:{idVal:a}})}}`. 

    


[_View in GitHub_](../lib/id.js) 

    
