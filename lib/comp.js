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
    debugger
    return (prevState) =>
      val.chain((innerValue) => [innerValue, prevState])
  },
  load (val) {
    debugger
    return (prevState) => [prevState, prevState]
  },
  save (val) {
    debugger
    return (prevState) => [val, val]
  }
}
