
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

class TurtleJisonContext {
  constructor (factory) {
    this.factory = factory;
    this.reset();
  }

  reset () {
    this._fileName = undefined; // for debugging
    this.curSubject = null;
    this.curPredicate = null;
    this.blankId = 0;
    this.skipped = { // space eaten by whitespace and comments
      first_line: 0,
      first_column: 0,
      last_line: 0,
      last_column: 0,
    };
    this._prefixes = {};
    this.triples = [];
  }

  _setFileName (fn) { this._fileName = fn; }

  skip (type, origText, yylloc){
    // space eaten by whitespace and comments
    if (this.skipped.last_line === yylloc.first_line &&
        this.skipped.last_column === yylloc.first_column) {
      // immediately follows a skipped span
      this.skipped.last_line = yylloc.last_line;
      this.skipped.last_column = yylloc.last_column;
    } else {
      // follows something else
      this.skipped = yylloc
    };
    return {type, origText};
  }

  // curSubject
  setSubject (s) { this.curSubject = s; return s; }
  finishSubject (l) { this.curSubject = null; return l; }

  makeFirstRest (startToken, elts, ws1, endToken) {
    const ret = {
      type: "collection",
      startToken,
      // TODO: move to rule for _Qobject_E_Star WSS collectionObject
      elts: elts.reduce((acc, elt) => acc.concat(elt.ws0, elt.elts), []), // pull out the ws0s and the elts
      ws1,
      endToken
    };

    if (ret.elts.length === 0) {
      ret.term = this.factory.namedNode(Rdf.nil);
    } else {
      let last = null;
      for (let i = 0; i < ret.elts.length; ++i) {
        const elt = ret.elts[i];
        switch (elt.type) {
        case "ws": break;
        case "collection": break;
        default:
          elt.ord = this.blankId++;
          elt.li = this.factory.blankNode();
          if (last === null) {
            // first element
            ret.term = elt.li;
          } else {
            this.addTriple(last, this.factory.namedNode(Rdf.rest), elt.li);
          }
          last = elt.li;

          this.addTriple(elt.li, this.factory.namedNode(Rdf.first), elt.term);
        }
      }
      this.addTriple(last, this.factory.namedNode(Rdf.rest), this.factory.namedNode(Rdf.nil));
    }
    return {node: ret, elts: [ret]};
  }

  // curPredicate
  setPredicate (p) { this.curPredicate = p; return p; }
  finishObjectList (o, l) { this.curPredicate = null; return o.concat(l); }

  startBlankNodePropertyList (startToken, startElts) {
    startToken.ord = this.blankId++;
    const subject = this.curSubject;
    this.setSubject(startToken);
    const predicate = this.curPredicate;
    this.setPredicate(null);
    startToken.term = this.factory.blankNode()
    return {startToken, subject, predicate}
  }

  finishBlankNodePropertyList ({startToken, subject, predicate}, ws1, predicateObjectList, endToken) {
    endToken.ord = startToken.ord;
    this.setSubject(subject);
    this.setPredicate(predicate);
    return {node: startToken, elts: [{
      type: "blankNodePropertyList",
      startToken, ws1, predicateObjectList, endToken
    }] };
  }

  createRelativeIri (yytext) {
    const unesc = this.unescapeText(yytext.substring(1, yytext.length - 1), {});
    const ret = {
      type: "relativeUrl",
      value: this._resolveIRI(unesc),
      origText: yytext
    };
    ret.term = this.factory.namedNode(ret.value)
    return ret;
  }
  createBlankNode (type, origText) {
    const ret = { type, origText, ord: this.blankId++ };
    ret.term = this.factory.blankNode(origText.substring(2));
    return ret;
  }
  createTypedLiteral (l, dtStr) {
    const ret = {
      type: "datatypedLiteral",
      String: l,
      datatype: { type: "BuiltInDatatype", value: dtStr },
    };
    ret.term = this.factory.literal(l.value, this.factory.namedNode(dtStr));
    return ret;
  }
  createParsedLiteral (type, String, languageOrDatatype) {
    const ret = Object.assign({ type, String }, languageOrDatatype);
    switch (type) {
    case "simpleLiteral": ret.term = this.factory.literal(String.value); break;
    case "langTagLiteral": ret.term = this.factory.literal(String.value, languageOrDatatype.language.value); break;
    case "datatypedLiteral": ret.term = this.factory.literal(String.value, this.factory.namedNode(languageOrDatatype.datatype.value)); break;
    }
    return ret;
  }

  finishTriple (o, elts) {
    this.addTriple(this.curSubject.term, this.curPredicate.term, o.term);
    return o;
  }

  addTriple (subject, predicate, object) {
    const t = {subject, predicate, object};
    this.triples.push(t);
    return t;
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
    // if (this.recoverable) {
    //   this.recoverable(e)
    //   this.reset();
    // } else {
      throw e;
    // }
  }

  // Expand declared prefix or throw Error
  expandPrefix (prefix) {
    if (!(prefix in this._prefixes))
      this.error(new Error('Parse error; unknown prefix "' + prefix + ':"'));
    return this._prefixes[prefix];
  }
/* LATER
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
*/

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

  // Tokens which include ws for lalr(1) resasons
  crackSkipped (yytext, yylloc) {
    const ws = [];
    let i = 0;
    while (true) {
      const rest = yytext.substring(i);
      const m = rest.match(/^(?:(\s+)|(#[^\r\n]*|\/\*(?:[^*]|\*(?:[^/]|\\\/))*\*\/))/s);
      if (!m)
        return {ws, rest};
      ws.push(
        m[1]
          ? this.skip('ws', m[1], yylloc)
          : this.skip('comment', m[2], yylloc)
      );
      i += m[0].length;
    }
  }

  // Unescaping scalars

  // Translates string escape codes in the string into their textual equivalent
  unescapeString (string, trimLength) {
    string = string.substring(trimLength, string.length - trimLength);
    return this.unescapeText(string, stringEscapeReplacements);
  }

  unescapeText (string, replacements) {
    const regex = /\\u([a-fA-F0-9]{4})|\\U([a-fA-F0-9]{8})|\\(.)/g;
    string = string.replace(regex, function (sequence, unicode4, unicode8, escapedChar) {
      let charCode;
      if (unicode4) {
        charCode = parseInt(unicode4, 16);
        // probably no longer helpful: if (isNaN(charCode)) throw new Error(); // can never happen (regex), but helps performance
        return String.fromCharCode(charCode);
      }
      else if (unicode8) {
        charCode = parseInt(unicode8, 16);
        // probably no longer helpful: if (isNaN(charCode)) throw new Error(); // can never happen (regex), but helps performance
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
}

function origText (obj) {
  return Object.keys(obj).reduce((acc, key) =>
    key === 'origText'                  // extract origText
      ? acc.concat([obj[key]])
      : typeof obj[key] === 'object'    // recurse nested objects
      ? acc.concat(origText(obj[key]))
      : acc                             // ignore other values
    , [])
}

// istanbul ignore else
if (typeof module !== 'undefined')
  module.exports = {TurtleJisonContext, origText}
