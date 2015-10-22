exports.state = {
  name: 'State',
  of (val) {
    return (prevState) => [val, prevState]
  },
  chain (funk, val, proto) {
    debugger
    return (prevState) =>
      proto.chain((params) => {
        const val = params[0], newState = params[1]
        return [funk(val), newState]
      }, val(prevState))
  },
  lift (val, proto) {
    return (prevState) =>
      proto.chain((innerValue) => [innerValue, prevState], val)
  },
  load (val) {
    return (prevState) => [prevState, prevState]
  },
  save (val) {
    return (prevState) => [val, val]
  }
}
