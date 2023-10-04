const {TurtleJisonContext} = require('./TurtleJisonContext');
const {TurtleJisonParser, TurtleJisonLexer} = require('./TurtleJison')

class TurtleParser {
  constructor ({baseIRI, factory}) {
    this.baseIRI = baseIRI;
    if (factory) {
      this.factory = factory;
    } else {
      const {DataFactory} = require('rdf-data-factory')
      this.factory = new DataFactory;
    }
  }

  parse (text, baseIRI = this.baseIRI, prefixes = {}) {
    const yy = new TurtleJisonContext(this.factory);
    yy._prefixes = Object.create(prefixes);
    yy._imports = [];
    yy._setBase(baseIRI);
    yy._setFileName(baseIRI);
    const lexer = new TurtleJisonLexer(yy);
    const parser = new TurtleJisonParser(yy, lexer)
    try {
      const parsed = parser.parse(text);
      return [parsed, yy.triples];
    } catch (e) {
      e.message += "\n" + lexer.showPosition();
      throw e;
    }
  }
}

if (typeof module !== 'undefined')
  module.exports = {TurtleParser};
