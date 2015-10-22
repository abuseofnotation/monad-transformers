exports.state = {
  name: 'State',
  of (val) {
    debugger
    return (prevState) => [val, prevState]
  },
  chain (funk, val) {
    debugger
    return (prevState) =>
      val._value(prevState).chain((params) => {
        const val = params[0], newState = params[1]
        return [funk(val), newState]
      })
  },
  lift (val) {
    return (prevState) =>
      val.chain((innerValue) => [innerValue, prevState])
  },
  load (val) {
    return (prevState) => [prevState, prevState]
  },
  save (val) {
    return (prevState) => [val, val]
  }
}
