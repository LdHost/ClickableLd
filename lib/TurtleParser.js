const {TurtleJisonContext} = require('./TurtleJisonContext');
const {TurtleJisonParser, TurtleJisonLexer} = require('./TurtleJison')

class TurtleParser {
  constructor (opts = {baseIRI: null, factory: null}) {
    const {baseIRI, factory} = opts;
    this.baseIRI = baseIRI;
    if (factory) {
      this.factory = factory;
    } else {
      const {DataFactory} = require('rdf-data-factory')
      this.factory = new DataFactory;
    }

    this.yy = new TurtleJisonContext(this.factory);
  }

  parse (text, baseIRI = this.baseIRI, prefixes = {}) {
    this.yy._setBase(baseIRI);
    this.yy._setFileName(baseIRI);
    for (const [prefix, namespace] of Object.entries(prefixes))
      this.yy._prefixes[prefix] = namespace;
    const lexer = new TurtleJisonLexer(this.yy);
    const parser = new TurtleJisonParser(this.yy, lexer)
    try {
      const parsed = parser.parse(text);
      return [parsed, this.yy.triples];
    } catch (e) {
      e.message += "\n" + lexer.showPosition();
      throw e;
    }
  }

  reset () {
    this.factory.resetBlankNodeCounter();
    this.yy.reset();
  }
}

// istanbul ignore else
if (typeof module !== 'undefined')
  module.exports = {TurtleParser};
