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
  wrap (val, proto) {
    return (prevState) =>
      proto.of(val(prevState))
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
  of (val) {
    return val.constructor === Array ? val : [val]
  },
  chain (funk, val, proto) {
    return val.reduce((list, val) =>
        list.concat(proto.chain(funk, val))
    , [])
  },
  lift (val, proto) {
    return proto.chain((innerValue) => proto.of(this.of(innerValue)), val)
  },
  wrap (val, proto) {
    return [proto.of(val)]
  }
}
