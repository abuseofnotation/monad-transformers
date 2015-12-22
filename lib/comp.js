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
    return (prevState) => this.outer.of([prevState, prevState])
  },
  save (val) {
    return (prevState) => this.outer.of([val, val])
  },
  statefulMap (funk, val) {
    return (prevState) => this.outer.of(funk(val, prevState))
  },
  statefulChain(funk, val) {
    return (prevState) => funk(val, prevState)
  },
  value (funk, state) {
    return this.outer.value((params) => {
      return funk(params[0])
    }, state())
  }
}
