class UnexpectedType extends Error {
  constructor (obj, expected) {
    super(`expected only ${expected} in ${JSON.stringify(obj)}`);
    this.obj = obj;
    this.expected = expected;
  }
}

class RenderClickableLd {
  static UseParent = ".";

  constructor (dom, baseIRI, text, mediaType, elementControls = {}) {
    this.dom = dom;
    this.baseIRI = baseIRI;
    this.text = text;
    this.mediaType = mediaType;
    this.elementControls = elementControls;
  }

  render (element) {
    if (this.mediaType !== 'text/turtle')
      throw Error(`media type ${this.mediaType} not supported; only "text/turtle" for now`);
    const parser = new TurtleParser.TurtleParser({baseIRI: this.baseIRI});
    const [parseTree, quads] = parser.parse(this.text);
    // element.innerText = TurtleJisonContext.exports.origText(parseTree).join('');
    this.renderStatementList(parseTree.statementList, element);
  }

  renderStatementList (statementList, element) {
    const ret = this.span("statementList", statementList, element);
    for (const statementOrWs of statementList) {
      this.renderStatement(statementOrWs, ret);
    }
    return ret;
  }

  renderStatement (statementOrWs, element) {
    const ret = this.span("statementOrWs", statementOrWs, element);
    const expected = [
      "ws",  "comment",
      "n3Prefix", "n3Base", "sparqlPrefix", "sparqlBase", "triples",
      "token",
    ];
    switch (statementOrWs.type) {
    case expected[0]: this.renderSkippedElt(statementOrWs, ret); break; // "ws"
    case expected[1]: this.renderSkippedElt(statementOrWs, ret); break; // "comment"
    case expected[2]: this.renderDirective(statementOrWs, ret); break; // prefix
    case expected[3]: this.renderDirective(statementOrWs, ret); break; // base
    case expected[4]: this.renderDirective(statementOrWs, ret); break; // sparqlPrefix
    case expected[5]: this.renderDirective(statementOrWs, ret); break; // sparqlBase
    case expected[6]: this.renderTriples(statementOrWs, ret); break; // "triples"
    case expected[7]: this.renderToken(statementOrWs, element); break; // token ('.')
    default: throw new UnexpectedType(statementOrWs, expected);
    }
    return ret;
  }

  renderDirective (directive, element) {
    const expected = [
      "n3Prefix", "n3Base", "sparqlPrefix", "sparqlBase"
    ];
    const ret = this.span("directive", directive, element);
    switch (directive.type) {
    case expected[0]: this.renderN3Prefix(directive, ret); break; // prefix
    case expected[1]: this.renderN3Base(directive, ret); break; // base
    case expected[2]: this.renderSparqlPrefix(directive, ret); break; // sparqlPrefix
    case expected[3]: this.renderSparqlBase(directive, ret); break; // sparqlBase
    default: throw new UnexpectedType(directive, expected);
    }
    return ret;
  }

  renderSparqlPrefix (sparqlPrefix, element) {
    const ret = this.span("sparqlPrefix", sparqlPrefix, element);
    this.renderKeyword(sparqlPrefix.keyword, ret);
    this.renderSkippedList(sparqlPrefix.ws1, ret);
    this.renderPrefix(sparqlPrefix.prefix, ret);
    this.renderSkippedList(sparqlPrefix.ws2, ret);
    this.renderNamespace(sparqlPrefix.namespace, ret);
    return ret;
  }

  renderPrefix (prefix, element) {
    const ret = this.span("prefix", prefix, element);
    ret.innerText = prefix.origText; // or value + ':'
    return ret;
  }

  renderNamespace (namespace, element) {
    const ret = this.span("namespace", namespace, element);
    this.renderTerm(namespace, ret); // renderIriForm?
    return ret;
  }

  renderTriples (triples, element) {
    const ret = this.span("triples", triples, element);
    this.renderSubject(triples.subject, ret);
    this.renderSkippedList(triples.ws1, ret);
    this.renderPredicateObjectListList(triples.predicateObjectList, ret);
    return ret;
  }

  renderSubject (subject, element) {
    const ret = this.span("subject", subject, element);
    this.renderTerm(subject, ret);
    return ret;
  }

  renderPredicateObjectListList (predicateObjectListList, element) {
    const ret = this.span("statementList", predicateObjectListList, element); // TODO: listlist
    for (const verbObjectListOrSemiOrWs of predicateObjectListList) {
      this.renderVerbObjectListOrSemiOrWs(verbObjectListOrSemiOrWs, ret);
    }
    return ret;
  }

  renderVerbObjectListOrSemiOrWs (verbObjectListOrSemiOrWs, element) {
    const expected = [
      "ws",  "comment",
      "verb_objectList", "token"
    ];
    switch (verbObjectListOrSemiOrWs.type) {
    case expected[0]: this.renderSkippedElt(verbObjectListOrSemiOrWs, element); break; // "ws"
    case expected[1]: this.renderSkippedElt(verbObjectListOrSemiOrWs, element); break; // "comment"
    case expected[2]: this.renderVerbObjectList(verbObjectListOrSemiOrWs, element); break; // verb_objectList
    case expected[3]: this.renderToken(verbObjectListOrSemiOrWs, element); break; // token (';')
    default: throw new UnexpectedType(verbObjectListOrSemiOrWs, expected);
    }
  }

  renderVerbObjectList (predicateObjectList, element) {
    const ret = this.span("predicateObjectList", predicateObjectList, element);
    this.renderVerb(predicateObjectList.verb, ret);
    this.renderSkippedList(predicateObjectList.ws1, ret);
    this.renderObjectList(predicateObjectList.objectList, ret);
    return ret;
  }

  renderVerb (verb, element) {
    const ret = this.span("verb", verb, element);
    this.renderTerm(verb, ret); // renderIriForm?
    return ret;
  }

  renderObjectList (objectList, element) {
    const ret = this.span("objectList", objectList, element);
    for (const objectOrCommaOrWs of objectList) {
      this.renderObjectOrCommaOrWs(objectOrCommaOrWs, ret);
    }
    return ret;
  }

  renderObjectOrCommaOrWs (objectOrCommaOrWs, element) {
    const expected = [
      "ws",  "comment",
      "relativeUrl",  "pname", "a",
      "BLANK_NODE_LABEL", "ANON", "blankNodePropertyList", "collection",
      "simpleLiteral", "datatypedLiteral", "langTagLiteral",
      "token",
    ];
    switch (objectOrCommaOrWs.type) {
    case expected[0]: this.renderSkippedElt(objectOrCommaOrWs, element); break; // "ws"
    case expected[1]: this.renderSkippedElt(objectOrCommaOrWs, element); break; // "comment"
    case expected[2]: this.renderObject(objectOrCommaOrWs, element); break; // relativeUrl
    case expected[3]: this.renderObject(objectOrCommaOrWs, element); break; // pname
    case expected[4]: this.renderObject(objectOrCommaOrWs, element); break; // a
    case expected[5]: this.renderObject(objectOrCommaOrWs, element); break; // BLANK_NODE_LABEL
    case expected[6]: this.renderObject(objectOrCommaOrWs, element); break; // ANON
    case expected[7]: this.renderObject(objectOrCommaOrWs, element); break; // blankNodePropertyList
    case expected[8]: this.renderObject(objectOrCommaOrWs, element); break; // collection
    case expected[9]: this.renderObject(objectOrCommaOrWs, element); break; // simpleLiteral
    case expected[10]: this.renderObject(objectOrCommaOrWs, element); break; // datatypedLiteral
    case expected[11]: this.renderObject(objectOrCommaOrWs, element); break; // langTagLiteral
    case expected[12]: this.renderToken(objectOrCommaOrWs, element); break; // token (',')
    default: throw new UnexpectedType(objectOrCommaOrWs, expected);
    }
  }

  renderObject (object, element) {
    const ret = this.span("object", object, element);
    this.renderTerm(object, ret);
    return ret;
  }

  renderTerm (term, element) {
    const expected = [
      "relativeUrl",  "pname", "a",
      "BLANK_NODE_LABEL", "ANON", "blankNodePropertyList", "collection",
      "simpleLiteral", "datatypedLiteral", "langTagLiteral"
    ];
    const ret = this.span("term", term, element);
    switch (term.type) {
    case expected[0]: this.renderRelativeUrl(term, ret); break; // relativeUrl
    case expected[1]: this.renderPname(term, ret); break; // pname
    case expected[2]: this.renderA(term, ret); break; // a
    case expected[3]: this.renderBLANK_NODE_LABEL(term, ret); break; // BLANK_NODE_LABEL
    case expected[4]: this.renderANON(term, ret); break; // ANON
    case expected[5]: this.renderBlankNodePropertyList(term, ret); break; // blankNodePropertyList
    case expected[6]: this.renderCollection(term, ret); break; // collection
    case expected[7]: this.renderSimpleLiteral(term, ret); break; // simpleLiteral
    case expected[8]: this.renderDatatypedLiteral(term, ret); break; // datatypedLiteral
    case expected[9]: this.renderLangTagLiteral(term, ret); break; // langTagLiteral
    default: throw new UnexpectedType(term, expected);
    }
    return ret;
  }

  renderRelativeUrl (relativeUrl, element) {
    const ret = this.span("relativeUrl", relativeUrl, element);
    ret.innerText = relativeUrl.origText;
    return ret;
  }

  renderPname (pname, element) {
    const ret = this.span("pname", pname, element);
    this.renderPrefix(pname.prefix, ret);
    this.renderLocalName(pname.localName, ret);
    return ret;
  }

  renderA (a, element) {
    const ret = this.span("a", a, element);
    ret.innerText = a.origText;
    return ret;
  }

  renderRelativeUrl (relativeUrl, element) {
    const ret = this.span("relativeUrl", relativeUrl, element);
    ret.innerText = relativeUrl.origText;
    return ret;
  }

  renderLocalName (localName, element) {
    const ret = this.span("localName", localName, element);
    ret.innerText = localName.origText; // renderIriForm?
    return ret;
  }

  renderBLANK_NODE_LABEL (BLANK_NODE_LABEL, element) {
    const ret = this.span("BLANK_NODE_LABEL", BLANK_NODE_LABEL, element);
    ret.innerText = BLANK_NODE_LABEL.origText;
    return ret;
  }

  renderANON (ANON, element) {
    const ret = this.span("ANON", ANON, element);
    ret.innerText = ANON.origText;
    return ret;
  }

  renderBlankNodePropertyList (blankNodePropertyList, element) {
    const {parentElt, startElt, endElt} = this.spanStartEnd("blankNodePropertyList", blankNodePropertyList, element, blankNodePropertyList.startToken, blankNodePropertyList.endToken);
    if (startElt !== parentElt)
      parentElt.append(startElt)
    this.renderToken(blankNodePropertyList.startToken, startElt);
    this.renderSkippedList(blankNodePropertyList.ws1, parentElt);
    this.renderPredicateObjectListList(blankNodePropertyList.predicateObjectList, parentElt);
    if (endElt !== parentElt)
      parentElt.append(endElt)
    this.renderToken(blankNodePropertyList.endToken, endElt);
    return parentElt;
  }

  renderCollection (collection, element) {
    const {parentElt, startElt, endElt} = this.spanStartEnd("collection", collection, element, collection.startToken, collection.endToken);
    throw Error('not done');
    parentElt.innerText = collection.origText;
    return parentElt;
  }

  renderString (string, element) {
    const ret = this.span("string", string, element);
    ret.innerText = string.origText;
    return ret;
  }

  renderSimpleLiteral (simpleLiteral, element) {
    const ret = this.span("simpleLiteral", simpleLiteral, element);
    this.renderString(simpleLiteral.String, ret);
    return ret;
  }

  renderDatatypedLiteral (datatypedLiteral, element) {
    const ret = this.span("datatypedLiteral", datatypedLiteral, element);
    this.renderString(datatypedLiteral.String, ret);
    this.renderDatatype(datatypedLiteral.datatype, ret);
    return ret;
  }

  renderLangTagLiteral (langTagLiteral, element) {
    const ret = this.span("langTagLiteral", langTagLiteral, element);
    this.renderString(langTagLiteral.String, ret);
    this.renderLanguage(langTagLiteral.language, ret);
    return ret;
  }

  renderDatatype (datatype, element) {
    const expected = [
      "BuiltInDatatype", "ParsedDatatype"
    ];
    switch (datatype.type) {
    case expected[0]: this.renderBuiltInDatatype(datatype, element); break; // "BuiltInDatatype"
    case expected[1]: this.renderParsedDatatype(datatype, element); break; // "ParsedDatatype"
    default: throw new UnexpectedType(datatype, expected);
    }
  }

  renderBuiltInDatatype (datatype, element) {
    const ret = this.span("datatype", datatype, element);
    // not rendered in Turtle because the String implied the datatype
    // ret.innerText = datatype.value;
    return ret;
  }

  renderParsedDatatype (datatype, element) {
    const ret = this.span("datatype", datatype, element);
    this.renderToken(datatype.token, ret);
    this.renderTerm(datatype.iri, ret); // renderIriForm?
    return ret;
  }

  renderLanguage (language, element) {
    const ret = this.span("language", language, element);
    ret.innerText = language.origText; // or '@' + value
    return ret;
  }

  renderToken (token, element) {
    const ret = this.span("token", token, element);
    ret.innerText = token.origText;
    return ret;
  }

  renderSkippedList (skippedList, element) {
    const ret = this.span("skippedList", skippedList, element);
    for (const skippedElt of skippedList)
      this.renderSkippedElt(skippedElt, ret);
    return ret;
  }

  renderSkippedElt (skippedElt, element) {
    const expected = ["ws",  "comment"];
    const ret = this.span("skippedElt", skippedElt, element);
    switch (skippedElt.type) {
    case expected[0]: this.renderWs(skippedElt, ret); break; // ws
    case expected[1]: this.renderComment(skippedElt, ret); break; // comment
    default: throw new UnexpectedType(skipped, expected);
    }
    return ret;
  }

  renderWs (ws, element) {
    const ret = this.span("ws", ws, element);
    ret.innerText = ws.origText;
    return ret;
  }

  renderComment (comment, element) {
    const ret = this.span("comment", comment, element);
    ret.innerText = comment.origText;
    return ret;
  }

  renderKeyword (keyword, element) {
    const ret = this.span("keyword", keyword, element);
    ret.innerText = keyword.origText;
    return ret;
  }

  // note early retur for UseParent
  spanStartEnd (elementType, turtleElement, parentDomElement, attrs = {}, startToken, endToken) {
    const control = this.elementControls[elementType];

    if (control) {
      if (control.useParent)
        return {parentElt: parentDomElement, startElt: parentDomElement, endElt: parentDomElement};
      if (!control.construct)
        return makeTree (this, elementType);
      const {parentElt, startElt, endElt} = control.construct(elementType, turtleElement, parentDomElement, startToken, endToken);

      const parentName = "className" in control ? control.className : elementType;
      if (parentName)
        parentElt.classList.add(parentName);
      const startClassNameAttr = "className/start"
      const startName = startClassNameAttr in control ? control[startClassNameAttr] : elementType;
      if (startName)
        startElt.classList.add(startName);

      const endClassNameAttr = "className/end"
      const endName = endClassNameAttr in control ? control[endClassNameAttr] : elementType;
      if (endName)
        endElt.classList.add(endName);

      parentDomElement.append(parentElt);
      return {parentElt, startElt, endElt};
    } else {
      return makeTree(this, elementType)
    }

    function makeTree (self, type) {
      const parentElt = self.span(elementType, turtleElement, parentDomElement, attrs);
      const startElt = self.span(elementType + "/start", startToken, parentElt, attrs, true);
      const endElt = self.span(elementType + "/end", endToken, parentElt, attrs, true);
      return {parentElt, startElt, endElt};
    }
  }

  span (elementType, turtleElement, parentDomElement, attrs = {}, _noAdd = false) {
    const control = this.elementControls[elementType];

    if (control) {
      if (control.useParent)
        return parentDomElement;
      const ret = control.construct
            ? control.construct(elementType, turtleElement, parentDomElement)
            : this.dom.createElement(control.domType || 'span');

      const className = "className" in control ? control.className : elementType;
      if (className)
        ret.classList.add(className);

      if (!_noAdd)
        parentDomElement.append(ret);
      return ret;
    } else {
      const ret = this.dom.createElement('span');
      ret.classList.add(elementType);
      if (!_noAdd)
        parentDomElement.append(ret);
      return ret;
    }
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    RenderClickableLd
  }
}
