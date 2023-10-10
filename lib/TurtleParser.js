const {TurtleJisonContext} = require('./TurtleJisonContext');
const {TurtleJisonParser, TurtleJisonLexer} = require('./TurtleJison')

class TurtleParser {
  constructor (opts = {baseIRI: null, factory: null}) {
    const {baseIRI, factory} = opts;
    this.baseIRI = baseIRI || null;
    this.factory = factory || null;

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
      return parser.parse(text);
    } catch (e) {
      e.message += "\n" + lexer.showPosition();
      throw e;
    }
  }

  getQuads () {
    if (!this.factory)
      throw Error('TurtleParser.getQuads() requires parser to have been initialized with a factory.');
    return this.yy.triples;
  }

  reset () {
    this.factory.resetBlankNodeCounter();
    this.yy.reset();
  }

  toRdfjs () { return this.yy.toRdfjs; }
  collectionLis () { return this.yy.collectionLis; }
  decorateRdfjs (parseTree) {
    if (!this.factory)
      throw Error('TurtleParser.decorateRdfjs() requires parser to have been initialized with a factory.');
    for (const [ptElt, rdfjsTerm] of this.toRdfjs()) {
      ptElt.term = rdfjsTerm;
    }
    for (const [ptElt, rdfjsTerm] of this.collectionLis()) {
      ptElt.li = rdfjsTerm;
    }
    return parseTree;
  }
}

// istanbul ignore else
if (typeof module !== 'undefined')
  module.exports = {TurtleParser};
