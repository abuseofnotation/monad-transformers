exports.state = {
  name: 'State',
  of (val) {
    return (prevState) => [val, prevState]
  },
  chain (funk, val, proto) {
    return (prevState) =>
      proto.chain((params) => {
        const val = params[0], newState = params[1]
        return funk(val)(newState)
      }, val(prevState))
  },
  lift (val, proto) {
    return (prevState) =>
      proto.chain((innerValue) => proto.of([innerValue, prevState]), val)
  },
  load (val) {
    return (prevState) => [prevState, prevState]
  },
  save (val) {
    return (prevState) => [val, val]
  }
}
exports.list = {
  name: 'List',
  of (val,proto) {
    return proto.of([val])
  },
  chain (funk, val, proto) {
    return proto.chain(innerVal => {
      const a = innerVal.map(funk)
      return a.reduce((arr, i) => {
        return proto.chain(a=>arr.concat(a), i)
      })
    }, val)
  },
  lift (val, proto) {
    return proto.chain(innerValue => proto.of([innerValue]), val)  
  }
}
