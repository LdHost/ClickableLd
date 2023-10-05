function RenderClickableLd (baseIRI, element, text, mediaType) {
  if (mediaType !== 'text/turtle')
    throw Error(`media type ${mediaType} not supported; only "text/turtle" for now`);
  const parser = new TurtleParser.TurtleParser({baseIRI});
  const [parseTree, quads] = parser.parse(text);
  console.log(TurtleJisonContext.exports.origText(parseTree).join(''));
}

if (typeof module !== "undefined") {
  module.exports = {
    RenderClickableLd
  }
}
