const {TurtleJisonContext} = require('./TurtleJisonContext');
const {TurtleJisonParser} = require('./TurtleJison')

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
    const parserState = new TurtleJisonContext(this.factory);
    parserState._prefixes = Object.create(prefixes);
    parserState._imports = [];
    parserState._setBase(baseIRI);
    parserState._setFileName(baseIRI);
    const parser = new TurtleJisonParser(parserState)
    const parsed = parser.parse(text);
    return [parsed, parserState.triples];
  }
}

if (typeof module !== 'undefined')
  module.exports = {TurtleParser};
