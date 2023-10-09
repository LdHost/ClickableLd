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
    const ret = this.span("statementList", element);
    for (const statementOrWs of statementList) {
      this.renderStatement(statementOrWs, ret);
    }
    return ret;
  }

  renderStatement (statementOrWs, element) {
    const ret = this.span("statement", element);
    const expected = [
      "ws",  "comment",
      "n3Prefix", "n3Base", "sparqlPrefix", "sparqlBase", "collection_predicateObjectList", "subject_predicateObjectList",
      "token",
    ];
    switch (statementOrWs.type) {
    case expected[0]: this.renderSkippedElt(statementOrWs, ret); break; // "ws"
    case expected[1]: this.renderSkippedElt(statementOrWs, ret); break; // "comment"
    case expected[2]: this.renderDirective(statementOrWs, ret); break; // prefix
    case expected[3]: this.renderDirective(statementOrWs, ret); break; // base
    case expected[4]: this.renderDirective(statementOrWs, ret); break; // sparqlPrefix
    case expected[5]: this.renderDirective(statementOrWs, ret); break; // sparqlBase
    case expected[6]: // collection_predicateObjectList - TODO: remove?
    case expected[7]: this.renderSubject_predicateObjectList(statementOrWs, ret); break; // "subject_predicateObjectList"
    case expected[8]: this.renderToken(statementOrWs, element); break; // token ('.')
    default: throw new UnexpectedType(statementOrWs, expected);
    }
    return ret;
  }

  renderDirective (statementOrWs, element) {
    const expected = [
      "n3Prefix", "n3Base", "sparqlPrefix", "sparqlBase"
    ];
    const ret = this.span("directive", element);
    switch (statementOrWs.type) {
    case expected[0]: this.renderN3Prefix(statementOrWs, ret); break; // prefix
    case expected[1]: this.renderN3Base(statementOrWs, ret); break; // base
    case expected[2]: this.renderSparqlPrefix(statementOrWs, ret); break; // sparqlPrefix
    case expected[3]: this.renderSparqlBase(statementOrWs, ret); break; // sparqlBase
    default: throw new UnexpectedType(statementOrWs, expected);
    }
    return ret;
  }

  renderSparqlPrefix (sparqlPrefix, element) {
    const ret = this.span("sparqlPrefix", element);
    this.renderKeyword(sparqlPrefix.keyword, ret);
    this.renderSkippedList(sparqlPrefix.ws1, ret);
    this.renderPrefix(sparqlPrefix.prefix, ret);
    this.renderSkippedList(sparqlPrefix.ws2, ret);
    this.renderNamespace(sparqlPrefix.namespace, ret);
    return ret;
  }

  renderPrefix (prefix, element) {
    const ret = this.span("prefix", element);
    ret.innerText = prefix.origText; // or value + ':'
    return ret;
  }

  renderNamespace (namespace, element) {
    const ret = this.span("namespace", element);
    this.renderTerm(namespace, ret); // renderIriForm?
    return ret;
  }

  renderSubject_predicateObjectList (subject_predicateObjectList, element) {
    const ret = this.span("subject_predicateObjectList", element);
    this.renderSubject(subject_predicateObjectList.subject, ret);
    this.renderSkippedList(subject_predicateObjectList.ws1, ret);
    this.renderPredicateObjectListList(subject_predicateObjectList.predicateObjectList, ret);
    return ret;
  }

  renderSubject (subject, element) {
    const ret = this.span("subject", element);
    this.renderTerm(subject, ret);
    return ret;
  }

  renderPredicateObjectListList (predicateObjectListListList, element) {
    const ret = this.span("statementList", element);
    for (const verbObjectListOrSemiOrWs of predicateObjectListListList) {
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
    const ret = this.span("predicateObjectList", element);
    this.renderVerb(predicateObjectList.verb, ret);
    this.renderSkippedList(predicateObjectList.ws1, ret);
    this.renderObjectList(predicateObjectList.objectList, ret);
    return ret;
  }

  renderVerb (verb, element) {
    const ret = this.span("verb", element);
    this.renderTerm(verb, ret); // renderIriForm?
    return ret;
  }

  renderObjectList (objectList, element) {
    const ret = this.span("objectList", element);
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
    const ret = this.span("object", element);
    this.renderTerm(object, ret);
    return ret;
  }

  renderTerm (term, element) {
    const expected = [
      "relativeUrl",  "pname", "a",
      "BLANK_NODE_LABEL", "ANON", "blankNodePropertyList", "collection",
      "simpleLiteral", "datatypedLiteral", "langTagLiteral"
    ];
    const ret = this.span("term", element);
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
    const ret = this.span("relativeUrl", element);
    ret.innerText = relativeUrl.origText;
    return ret;
  }

  renderPname (pname, element) {
    const ret = this.span("pname", element);
    this.renderPrefix(pname.prefix, ret);
    this.renderLocalName(pname.localName, ret);
    return ret;
  }

  renderA (a, element) {
    const ret = this.span("a", element);
    ret.innerText = a.origText;
    return ret;
  }

  renderRelativeUrl (relativeUrl, element) {
    const ret = this.span("relativeUrl", element);
    ret.innerText = relativeUrl.origText;
    return ret;
  }

  renderLocalName (localName, element) {
    const ret = this.span("localName", element);
    ret.innerText = localName.origText; // renderIriForm?
    return ret;
  }

  renderBLANK_NODE_LABEL (BLANK_NODE_LABEL, element) {
    const ret = this.span("BLANK_NODE_LABEL", element);
    ret.innerText = BLANK_NODE_LABEL.origText;
    return ret;
  }

  renderANON (ANON, element) {
    const ret = this.span("ANON", element);
    ret.innerText = ANON.origText;
    return ret;
  }

  renderBlankNodePropertyList (blankNodePropertyList, element) {
    const ret = this.span("blankNodePropertyList", element);
    this.renderToken(blankNodePropertyList.startToken, ret);
    this.renderSkippedList(blankNodePropertyList.ws1, ret);
    this.renderPredicateObjectListList(blankNodePropertyList.predicateObjectList, ret);
    this.renderToken(blankNodePropertyList.endToken, ret);
    return ret;
  }

  renderCollection (collection, element) {
    const ret = this.span("collection", element);
    ret.innerText = collection.origText;
    return ret;
  }

  renderString (string, element) {
    const ret = this.span("string", element);
    ret.innerText = string.origText;
    return ret;
  }

  renderSimpleLiteral (simpleLiteral, element) {
    const ret = this.span("simpleLiteral", element);
    this.renderString(simpleLiteral.String, ret);
    return ret;
  }

  renderDatatypedLiteral (datatypedLiteral, element) {
    const ret = this.span("datatypedLiteral", element);
    this.renderString(datatypedLiteral.String, ret);
    this.renderDatatype(datatypedLiteral.datatype, ret);
    return ret;
  }

  renderLangTagLiteral (langTagLiteral, element) {
    const ret = this.span("langTagLiteral", element);
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
    const ret = this.span("BuiltInDatatype", element);
    // not rendered in Turtle because the String implied the datatype
    // ret.innerText = datatype.value;
    return ret;
  }

  renderParsedDatatype (datatype, element) {
    const ret = this.span("ParsedDatatype", element);
    this.renderToken(datatype.token, ret);
    this.renderTerm(datatype.iri, ret); // renderIriForm?
    return ret;
  }

  renderLanguage (language, element) {
    const ret = this.span("language", element);
    ret.innerText = language.origText; // or '@' + value
    return ret;
  }

  renderToken (token, element) {
    const ret = this.span("token", element);
    ret.innerText = token.origText;
    return ret;
  }

  renderSkippedList (skippedList, element) {
    const ret = this.span("skippedList", element);
    for (const skippedElt of skippedList)
      this.renderSkippedElt(skippedElt, ret);
    return ret;
  }

  renderSkippedElt (skippedElt, element) {
    const expected = ["ws",  "comment"];
    const ret = this.span("skippedElt", element);
    switch (skippedElt.type) {
    case expected[0]: this.renderWs(skippedElt, ret); break; // ws
    case expected[1]: this.renderComment(skippedElt, ret); break; // comment
    default: throw new UnexpectedType(skipped, expected);
    }
    return ret;
  }

  renderWs (ws, element) {
    const ret = this.span("ws", element);
    ret.innerText = ws.origText;
    return ret;
  }

  renderComment (comment, element) {
    const ret = this.span("comment", element);
    ret.innerText = comment.origText;
    return ret;
  }

  renderKeyword (keyword, element) {
    const ret = this.span("keyword", element);
    ret.innerText = keyword.origText;
    return ret;
  }

  // note early retur for UseParent
  span (elementType, parent, attrs = {}) {
    const control = this.elementControls[elementType];

    if (control) {
      if (control.useParent)
        return parent;
      const ret = control.construct
            ? control.construct(elementType, parent)
            : this.dom.createElement(control.domType || 'span');

      const className = "className" in control ? control.className : elementType;
      if (className)
        ret.classList.add(className);

      parent.append(ret);
      return ret;
    } else {
      const ret = this.dom.createElement('span');
      ret.classList.add(elementType);
      parent.append(ret);
      return ret;
    }
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    RenderClickableLd
  }
}
