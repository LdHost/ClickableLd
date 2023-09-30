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

const schemeAuthority = /^(?:([a-z][a-z0-9+.-]*:))?(?:\/\/[^\/]*)?/i,
    dotSegments = /(?:^|\/)\.\.?(?:$|[\/#?])/;

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
    this._prefixes = this._imports = this._sourceMap = this.shapes = this.productions = this.start = this.startActs = null; // Reset state.
    this._base = this._baseIRI = this._baseIRIPath = this._baseIRIRoot = null;
  }

  _setFileName (fn) { this._fileName = fn; }
  setSubject (s) { this.curSubject = s; return []; }
  collectionSubject (elts) {console.log("HERE", elts)
    if (elts.length === 0) {
      this.curSubject = Rdf.nil;
      return [];
    }

    this.curSubject = this.createBlankNode();
    const ret = [];
    let head= this.curSubject;
    for (let i = 0; i < elts.length; ++i) {
      const elt = elts[i];
      ret.push({subject: head, predicate: Rdf.first, object: elt});
      const next = i === elts.length -1
        ? Rdf.nil
        : this.createBlankNode();
      ret.push({subject: head, predicate: Rdf.rest, object: next});
      head = next;
    }
    return ret;
  }
  finishSubject (l) { this.curSubject = null; return l; }

  setPredicate (p) { this.curPredicate = p; }
  finishObjectList (l) { this.curPredicate = null; return l; }
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
    const ret = {subject: this.curSubject, predicate: this.curPredicate, object: o};
    console.log(JSON.stringify(ret));
    return ret;
  }

  // N3.js:lib/N3Parser.js<0.4.5>:58 with
  //   s/this\./ShExJisonParser./g
  // ### `_setBase` sets the base IRI to resolve relative IRIs.
  _setBase (baseIRI) {
    if (!baseIRI)
      baseIRI = null;

    // baseIRI '#' check disabled to allow -x 'data:text/shex,...#'
    // else if (baseIRI.indexOf('#') >= 0)
    //   throw new Error('Invalid base IRI ' + baseIRI);

    // Set base IRI and its components
    if (this._base = baseIRI) {
      this._basePath   = baseIRI.replace(/[^\/?]*(?:\?.*)?$/, '');
      baseIRI = baseIRI.match(schemeAuthority);
      this._baseRoot   = baseIRI[0];
      this._baseScheme = baseIRI[1];
    }
  }

  // N3.js:lib/N3Parser.js<0.4.5>:576 with
  //   s/this\./ShExJisonParser./g
  //   s/token/iri/
  // ### `_resolveIRI` resolves a relative IRI token against the base path,
  // assuming that a base path has been set and that the IRI is indeed relative.
  _resolveIRI (iri) {
    switch (iri[0]) {
    // An empty relative IRI indicates the base IRI
    case undefined: return this._base;
    // Resolve relative fragment IRIs against the base IRI
    case '#': return this._base + iri;
    // Resolve relative query string IRIs by replacing the query string
    case '?': return this._base.replace(/(?:\?.*)?$/, iri);
    // Resolve root-relative IRIs at the root of the base IRI
    case '/':
      // Resolve scheme-relative IRIs to the scheme
      return (iri[1] === '/' ? this._baseScheme : this._baseRoot) + this._removeDotSegments(iri);
    // Resolve all other IRIs at the base IRI's path
    default: {
      return this._removeDotSegments(this._basePath + iri);
    }
    }
  }

  // ### `_removeDotSegments` resolves './' and '../' path segments in an IRI as per RFC3986.
  _removeDotSegments (iri) {
    // Don't modify the IRI if it does not contain any dot segments
    if (!dotSegments.test(iri))
      return iri;

    // Start with an imaginary slash before the IRI in order to resolve trailing './' and '../'
    const length = iri.length;
    let result = '', i = -1, pathStart = -1, next = '/', segmentStart = 0;

    while (i < length) {
      switch (next) {
      // The path starts with the first slash after the authority
      case ':':
        if (pathStart < 0) {
          // Skip two slashes before the authority
          if (iri[++i] === '/' && iri[++i] === '/')
            // Skip to slash after the authority
            while ((pathStart = i + 1) < length && iri[pathStart] !== '/')
              i = pathStart;
        }
        break;
      // Don't modify a query string or fragment
      case '?':
      case '#':
        i = length;
        break;
      // Handle '/.' or '/..' path segments
      case '/':
        if (iri[i + 1] === '.') {
          next = iri[++i + 1];
          switch (next) {
          // Remove a '/.' segment
          case '/':
            result += iri.substring(segmentStart, i - 1);
            segmentStart = i + 1;
            break;
          // Remove a trailing '/.' segment
          case undefined:
          case '?':
          case '#':
            return result + iri.substring(segmentStart, i) + iri.substr(i + 1);
          // Remove a '/..' segment
          case '.':
            next = iri[++i + 1];
            if (next === undefined || next === '/' || next === '?' || next === '#') {
              result += iri.substring(segmentStart, i - 2);
              // Try to remove the parent path from result
              if ((segmentStart = result.lastIndexOf('/')) >= pathStart)
                result = result.substr(0, segmentStart);
              // Remove a trailing '/..' segment
              if (next !== '/')
                return result + '/' + iri.substr(i + 1);
              segmentStart = i + 1;
            }
          }
        }
      }
      next = iri[++i];
    }
    return result + iri.substring(segmentStart);
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
