
exports.idWrapped = {
  name: 'idWrapped',
  of (val) { 
    return {idContainer:this.outer.of({idVal: val })}
  },
  chain (funk, val) {
    return {
      idContainer:this.outer.chain((innerId) => {
        const val = funk(innerId.idVal)
        return val.idContainer
      }, val.idContainer)
    }
  },
  lift (val) {
    return {idContainer:this.outer.chain((innerValue) => this.outer.of({idVal: innerValue}), val)}
  }
}
exports.id = {
  name: 'ID',
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
  wrap (val) {
    return this.outer.of(val)
  }
}

