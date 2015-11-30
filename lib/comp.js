
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
exports.state = {
  name: 'State',
  of (val) {
    return (prevState) => this.outer.of([val, prevState])
  },
  chain (funk, state) {
    return (prevState) =>
      this.outer.chain((params) => {
        const newVal = params[0], newState = params[1]
        return funk(newVal)(newState)
      }, state(prevState))
  },
  lift (val) {
    return (prevState) =>
      this.outer.chain((innerValue) => this.outer.of([innerValue, prevState]), val)
  },
  load (val) {
    return (prevState) => {
      const state = val(prevState)
      this.outer.of([state[1], state[1]])
    }
  },
  save (val) {
    return (prevState) => {
      const state = val(prevState)
      this.outer.of([state[0], state[0]])
    }
  },
  mapState (funk, val) {
    return (prevState) => {
      const state = val(prevState)
      this.outer.of(funk(val(prevState)))
    }
  },
  value (funk, state) {
    return this.outer.value((params) => {
      return funk(params[0])
    }, state())
  }
}

exports.stream = {
  name: 'Stream',
  of (val) {
    return (add) => {
      add(this.outer.of(val))
    }
  },
  chain (funk, stream) {
    return (add) => {
      stream((val) => {
        this.outer.chain((innerVal) => {
          funk(innerVal)(add)
        }, val)
      })
    }
  },
  value (funk, stream) {
    stream(value => {
      return this.outer.value(funk, value)
    })
  },
  filter (funk, val) {
    return (add) => {
      val(val => {
        if (funk(val)) {
          add(val)
        }
      })
    }
  },
  fromPublisher (externalPublisher) {
    return (add) => {
      externalPublisher((val) => {
        add(this.outer.of(val))
      })
    }
  }
}
