/*
 * #Three implementations of the Identity Monad Transformer
 *
 * Monad transformers are tricky. All of them do the same thing (given a monad A, they produce a
 * monad B(A) which somehow augments A), but they do have to follow any rules while doing it.
 *
 * One huge difference is that some monad transformers only deal with the value inside the given
 * monad A and some add additional structure to the monad itself. An example of the first type
 * is the 'Maybe' monad transformer, which given a value of type  M(A) (monad that encapsulates
 * an A), creates a value of type M(Maybe(A)). An example of the second type is the 'State'
 * monad, which given the same value M(A), will produce something like () =>{ M([A, State]) }.
 * That is, the transformer adds the state value to the 'host' monad 'M', and then it wraps the
 * monad itself in a function.
 *
 * So far this sounds not that important, but what happens when you compose several monads
 * together? We are about to find out in the examples.
 */

/* Consider the identity Monad transformer. A transformer that produces a monad which behaves
 * the same way as the one it is given as an argument. One way to write it is just to wrap the
 * underlying value (which we called A) in an plain object.
 * So M(A) becomes M ({idVal:A}).
 * Here is how this implementation would look in this case:
 */

exports.id = {
  name: 'Id',

  // (a) => M({idVal:a})
  of (val) {
    return this.outer.of({idVal: val })
  },

  // (a => M({idVal:a}) , M({idVal:a})) => M({idVal:a})
  chain (funk, val) {
    return this.outer.chain((innerId) => {
      return funk(innerId.idVal)
    }, val)
  },

  // (M(a)) => M({idVal:a})
  lift (val) {
    return this.outer.chain((innerValue) => this.outer.of({idVal: innerValue}), val)
  },

  // ((a) => b, M({idVal:a})) => b
  value (funk, val) {
    return this.outer.value((innerId)=> {
      return funk(innerId.idVal)
    }, val)
  }
}

/* Notice that We are always returning an instance of the outer monad, so if you are to apply
 * the transformation several times, you get a simple nested value: M({idVal:{idVal: a}})
 *
 * Now consider an alternative, a little more complex implementation of the ID monad. One
 * which wraps the M monad into another plain object, so the value of M(A) becomes
 * {idContainer: M({idVal:a})}. Notice that the transformer consists of two parts which wrap
 * around the host monad:
 */

exports.idWrapped = {
  name: 'IdWrapped',

  // (a) => {idContainer: M({idVal:a})}
  of (val) {
    return {
      idContainer: this.outer.of({idVal: val})
    }
  },

  // (a => {idContainer:M({idVal:a})}, {idContainer:M({idVal:a})}) => {idContainer:M({idVal:a})}
  chain (funk, id) {
    return {
      idContainer: this.outer.chain((innerId) => {
        const val = funk(innerId.idVal)
        return val.idContainer
      }, id.idContainer)
    }
  },

  // (M(a)) => {idContainer:M({idVal:a})}
  lift (val) {
    return {
      idContainer: this.outer.chain((innerValue) => this.outer.of({idVal: innerValue}), val)
    }
  },

  // ((a) => b, M({idVal:a})) => b
  value (funk, val) {
    return this.outer.value((innerId)=> {
      return funk(innerId.idVal)
    }, val.idContainer)
  }
}

/* The key difference is that this monad nests in both directions. If we apply it two times
 * the value becomes: {idContainer:{idContainer:M({idVal:{idVal:a}})}}. Thus, when
 */
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
