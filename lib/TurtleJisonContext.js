
// Regular expression and replacement strings to escape strings
const stringEscapeReplacements = { '\\': '\\', "'": "'", '"': '"',
                                   't': '\t', 'b': '\b', 'n': '\n', 'r': '\r', 'f': '\f' },
      semactEscapeReplacements = { '\\': '\\', '%': '%' },
      pnameEscapeReplacements = {
        '\\': '\\', "'": "'", '"': '"',
        'n': '\n', 'r': '\r', 't': '\t', 'f': '\f', 'b': '\b',
        '_': '_', '~': '~', '.': '.', '-': '-', '!': '!', '$': '$', '&': '&',
        '(': '(', ')': ')', '*': '*', '+': '+', ',': ',', ';': ';', '=': '=',
        '/': '/', '?': '?', '#': '#', '@': '@', '%': '%',
      };

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

const absoluteIRI = /^[a-z][a-z0-9+.-]*:/i;

class TurtleJisonContext {
  constructor (factory) {
    this.factory = factory;
    this.curSubject = null;
    this.curPredicate = null;
    this.blankId = 0;
    this.whitespace = [];
    this._fileName = undefined; // for debugging
    this.skipped = { // space eaten by whitespace and comments
      first_line: 0,
      first_column: 0,
      last_line: 0,
      last_column: 0,
    };
    this.triples = [];
    this.locations = {  };
  }

  reset () {
    this._base = this._prefixes = this._imports = this._sourceMap = null;
  }

  _setFileName (fn) { this._fileName = fn; }

  // curSubject
  setSubject (s) { this.curSubject = s; return s; }
  collectionSubject (elts) {
    const x = this.makeFirstRest(elts);
    this.setSubject(x.node);
    return x.nested;
  }
  finishSubject (l) { this.curSubject = null; return l; }

  // curPredicate
  setPredicate (p) { this.curPredicate = p; return p; }
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

  createRelativeIri (yytext) {
    const unesc = this.unescapeText(yytext.substring(1, yytext.length - 1), {});
    const ret = {
      type: "relativeUrl",
      value: this._base === null || absoluteIRI.test(unesc) ? unesc : this._resolveIRI(unesc),
      origText: yytext
    };
    if (this.factory)
      ret.term = this.factory.blankNode(ret.value)
    return ret;
  }
  createBlankNode (label) {
    const ret = Object.assign({ nodeType: "BlankNode"}, label ? { value: label } : { ord: this.blankId++ });
    if (this.factory)
      ret.term = this.factory.blankNode(label)
    return ret;
  }
  createTypedLiteral (l, dtStr) {
    const ret = {
      type: "datatypedLiteral",
      String: l,
      datatype: { type: "BuiltInDatatype", value: dtStr },
    };
    if (this.factory)
      ret.term = this.factory.literal(String.value, this.factory.namedNode(dtStr))
    return ret;
  }
  createParsedLiteral (type, String, ws1, languageOrDatatype) {
    const ret = Object.assign({ type, String, ws1 }, languageOrDatatype);
    if (this.factory) {
      switch (type) {
      case "simpleLiteral": ret.term = this.factory.literal(String.value); break;
      case "langTagLiteral": ret.term = this.factory.literal(String.value, languageOrDatatype.language.value); break;
      case "datatypedLiteral": ret.term = this.factory.literal(String.value, this.factory.namedNode(languageOrDatatype.datatype.value)); break;
      }
    }
    return ret;
  }

  finishTriple (o) {
    this.addTriple(this.curSubject.term, this.curPredicate.term, o ? o.term : null);
    return o;
  }

  addTriple (subject, predicate, object) {
    const t = {subject, predicate, object};
    this.triples.push(t);
    return t;
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
      ret.push(this.addTriple(head, Rdf.first, elt.node));
      const next = i === elts.length -1
        ? Rdf.nil
        : this.createBlankNode();
      ret.push(this.addTriple(head, Rdf.rest, next));
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

  addWhitespace (s) { this.whitespace.push(s); }
  getWhitespace () { return this.whitespace.splice(0, this.whitespace.length); }

  parsePrefix (pname) {
    const namePos1 = pname.indexOf(':');
    const prefix = pname.substring(0, namePos1);
    return { "type": "prefix", "value": prefix, "origText": prefix + ":"};
  }

  parsePName (pname) {
    const namePos1 = pname.indexOf(':');
    const prefix = pname.substring(0, namePos1);
    const localName = pname.substring(namePos1 + 1);
    const unescaped = this.unescapeText(localName, pnameEscapeReplacements);
    const value = this.expandPrefix(prefix) + unescaped;
    return { "type": "pname", "value": value,
             "prefix": { "type": "prefix", "value": prefix, "origText": prefix + ":"},
             "localName": { "type": "localName", "value": unescaped, "origText": localName}
           };
  }

  // Translates string escape codes in the string into their textual equivalent
  unescapeString (string, trimLength) {
    string = string.substring(trimLength, string.length - trimLength);
    return this.unescapeText(string, stringEscapeReplacements);
  }

  unescapeLangString (string, trimLength) {
    const at = string.lastIndexOf("@");
    const lang = string.substr(at);
    string = string.substr(0, at);
    const u = this.unescapeString(string, trimLength);
    return extend(u, { language: lowercase(lang.substr(1)) });
  }

  unescapeText (string, replacements) {
    const regex = /\\u([a-fA-F0-9]{4})|\\U([a-fA-F0-9]{8})|\\(.)/g;
    try {
      string = string.replace(regex, function (sequence, unicode4, unicode8, escapedChar) {
        let charCode;
        if (unicode4) {
          charCode = parseInt(unicode4, 16);
          if (isNaN(charCode)) throw new Error(); // can never happen (regex), but helps performance
          return String.fromCharCode(charCode);
        }
        else if (unicode8) {
          charCode = parseInt(unicode8, 16);
          if (isNaN(charCode)) throw new Error(); // can never happen (regex), but helps performance
          if (charCode < 0xFFFF) return String.fromCharCode(charCode);
          return String.fromCharCode(0xD800 + ((charCode -= 0x10000) >> 10), 0xDC00 + (charCode & 0x3FF));
        }
        else {
          const replacement = replacements[escapedChar];
          if (!replacement) throw new Error("no replacement found for '" + escapedChar + "'");
          return replacement;
        }
      });
      return string;
    }
    catch (error) { console.warn(error); return ''; }
  }
}

if (typeof module !== 'undefined')
  module.exports = {TurtleJisonContext}
