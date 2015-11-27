/*
 * #Three implementations of the Identity Monad Transformer
 *
 * Monad transformers are tricky. All of them do the same thing (given a monad A, they produce a
 * monad B(A) which somehow augments A), but they do have to follow any rules while doing it.
 *
 * One huge difference is that some monad transformers only deal with the value inside the given
 * monad A and some add additional structure to the monad itself. An example of the first type
 * is the 'Maybe' monad transformer, which given a value of type  M(A), creates a value of type
 * M(Maybe(A)). An example of the second type is the 'State' monad, which given the same value
 * M(A), will produce something like () =>{ M([A, State]) }. That is, the transformer adds the
 * state value to the 'host' monad 'M', and then it wraps the monad itself in a function.
 *
 * So far this sounds not that important, but what happens when you compose several monads
 * together? We are about to find out in the examples.
 */

 /* Consider the identity Monad transformer. A transformer that produces a monad which behaves
  * the same way as the one it is given as an argument.
  */
exports.id = {
  name: 'Id',
  of (val) {
    return this.outer.of({idVal: val })
  },
  chain (funk, val) {
    return this.outer.chain((innerId) => {
      return funk(innerId.idVal)
    }, val)
  },
  lift (val) {
    return this.outer.chain((innerValue) => this.outer.of({idVal: innerValue}), val)
  },
  value (funk, val) {
    return this.outer.value((innerId)=> {
      return funk(innerId.idVal)
    }, val)
  }
}
exports.idWrapped = {
  name: 'IdWrapped',
  of (val) {
    return {
      idContainer: this.outer.of({idVal: val})
    }
  },
  chain (funk, id) {
    return {
      idContainer: this.outer.chain((innerId) => {
        const val = funk(innerId.idVal)
        return val.idContainer
      }, id.idContainer)
    }
  },
  lift (val) {
    return {
      idContainer: this.outer.chain((innerValue) => this.outer.of({idVal: innerValue}), val)
    }
  },
  value (funk, val) {
    return this.outer.value((innerId)=> {
      return funk(innerId.idVal)
    }, val.idContainer)
  }
}
exports.idMinimal = {
  name: 'idMinimal',
  of (val) {
    return this.outer.of(val)
  },
  chain (funk, val) {
    return this.outer.chain(funk, val)
  },
  lift (val) {
    return val
  },
  value (funk, val) {
    return this.outer.value(funk, val)
  }
}
