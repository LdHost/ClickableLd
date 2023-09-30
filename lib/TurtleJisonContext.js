const Ns = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
}
const Rdf = {
  nil: Ns.rdf + 'nil',
  first: Ns.rdf + 'first',
  rest: Ns.rdf + 'rest',
  type: Ns.rdf + 'type',
}
const Xsd = {
  integer: Ns.xsd + 'integer',
  float: Ns.xsd + 'float',
  decimal: Ns.xsd + 'decimal',
  string: Ns.xsd + 'string',
}

class TurtleJisonContext {
  constructor () {
    this.curSubject = null;
    this.curPredicate = null;
    this.blankId = 0;
    this._fileName = undefined; // for debugging
    this.skipped = { // space eaten by whitespace and comments
      first_line: 0,
      first_column: 0,
      last_line: 0,
      last_column: 0,
    };
    this.locations = {  };
  }

  reset () {
    this._base = this._prefixes = this._imports = this._sourceMap = null;
  }

  _setFileName (fn) { this._fileName = fn; }

  // curSubject
  setSubject (s) { this.curSubject = s; return []; }
  collectionSubject (elts) {
    const x = this.makeFirstRest(elts);
    this.setSubject(x.node);
    return x.nested;
  }
  finishSubject (l) { this.curSubject = null; return l; }

  // curPredicate
  setPredicate (p) { this.curPredicate = p; }
  finishObjectList (l) { this.curPredicate = null; return l; }

  startBlankNodePropertyList () {
    const subject = this.curSubject;
    this.setSubject(this.createBlankNode());
    const predicate = this.curPredicate;
    this.setPredicate(null);
    return {subject, predicate}
  }

  finishBlankNodePropertyList (triples, {subject, predicate}) {
    this.setSubject(subject);
    this.setPredicate(predicate);
    return triples;
  }

  createBlankNode (l) { return Object.assign({ nodeType: "BlankNode"}, l ? { value: l } : { ord: this.blankId++ }); }
  createLiteral (l, langOrDt) {
    return Object.assign(
      { value: l },
      typeof langOrDt === "string"
        ? { language: langOrDt }
      : { datatype: langOrDt || Xsd.string }
    );
  }

  triple (o) {
    return {subject: this.curSubject, predicate: this.curPredicate, object: o};
  }

  makeFirstRest (elts) {
    if (elts.length === 0) {
      return {node: Rdf.nil, nested: []};
    }

    const retNode = this.createBlankNode();
    const ret = [];
    let head = retNode;
    for (let i = 0; i < elts.length; ++i) {
      const elt = elts[i];
      Array.prototype.push.apply(ret, elt.nested);
      ret.push({subject: head, predicate: Rdf.first, object: elt.node});
      const next = i === elts.length -1
        ? Rdf.nil
        : this.createBlankNode();
      ret.push({subject: head, predicate: Rdf.rest, object: next});
      head = next;
    }
    return {node: retNode, nested: ret}
  }

  _setBase (baseIRI) {
    if (baseIRI) {
      this._base = new URL(baseIRI)
      new URL('.', this._base); // throw if not legal base IRI    
    } else {
      this._base = null;
    }
  }

  _resolveIRI (iri) {
    return this._base ? new URL(iri, this._base).href : iri;
  }

  error (e) {
    const hash = {
      text: this.lexer.match,
      // token: this.terminals_[symbol] || symbol,
      line: this.lexer.yylineno,
      loc: this.lexer.yylloc,
      // expected: expected
      pos: this.lexer.showPosition()
    }
    e.hash = hash;
    if (this.recoverable) {
      this.recoverable(e)
    } else {
      throw e;
      this.reset();
    }
  }

  // Expand declared prefix or throw Error
  expandPrefix (prefix) {
    if (!(prefix in this._prefixes))
      this.error(new Error('Parse error; unknown prefix "' + prefix + ':"'));
    return this._prefixes[prefix];
  }

  makeLocation (start, end) {
    if (end.first_line === this.skipped.last_line && end.first_column === this.skipped.last_column)
      end = this.skipped
    return {
      filename: this._fileName,
      first_line: start.first_line,
      first_column: start.first_column,
      last_line: end.first_line,
      last_column: end.first_column,
    }
  }
}

if (typeof module !== 'undefined')
  module.exports = {TurtleJisonContext}
