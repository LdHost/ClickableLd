
class ExtensionList {
  constructor () {
    this.extensions = [];
  }

  add (ext) {
    this.extensions.push(ext);
  }

  ready () {
    return Promise.all(
      this.extensions.filter(
        e => typeof e.ready === "function"
      ).map(
        e => e.ready()
      ));
  }

  findOwner (targetUrlStr, element, title, popup) {
    return this.extensions.find(ext => ext.adopt(targetUrlStr, element, title, popup));
  }
}
const extensionList = new ExtensionList();

class LocalCachedList {
  constructor (base) {
    this.loaded = [];
    const listUrl = new URL("tooltips/_list.json", base);
    this.list = fetch(listUrl)
      .then(resp => resp.text())
      .then(text => {
        const list = JSON.parse(text);
        for (const src of list) {
          if (src.url) {
            src.ready = fetch(new URL(src.url, listUrl))
              .then(resp => resp.json())
              .then(deets => { // hack in something to display in the namespace decl
                deets[src.namespace] = {label: src.label, definition: `namespace for ${src.label}`};
                return deets;
              });
          } else {
            const deets = {}
            deets[src.namespace] = {label: src.label, definition: `namespace for ${src.label}`};
            src.ready = Promise.resolve(deets);
          }
          this.loaded.push(src);
        }
        return list;
      })
      .catch(
        e => {
          console.log(e instanceof Error);
          throw e;
        }
      );
  }
  ready () { return this.list; }
  adopt (targetUrlStr, element, title, popup) {
    const matched = this.loaded.find(l => targetUrlStr.indexOf(l.namespace) === 0);
    if (!matched) return null;
    matched.ready.then(deets => {
      const x = deets[targetUrlStr];
      if (x)
        return popup(element, title, x.label, x.definition);
    })
      .catch(
        e => popup(element, title, e.stack)
      );
    return true;
  }
}
extensionList.add(new LocalCachedList(location));

// no CORS at remote site requires local cache; makes this of limited utility
class Hpp {
  constructor (base) {
    // this.hpo_data = fetch("https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/hp.json") CORS hell
    this.hpo_data = fetch("extensions/hpo-data.json")
      .then(resp => resp.text())
      .then(text => JSON.parse(text)/*.graphs[0].nodes*/)
      .catch(e => {console.log(e instanceof Error); throw e;});
  }
  adopt (targetUrlStr, element, title, popup) {
    if (!targetUrlStr.startsWith('http://purl.obolibrary.org/obo/HP_'))
      return false;
    this.hpo_data
      .then(nodes => {
        const x = nodes.find(n => n.id === targetUrlStr);
        return popup(element, title, x ? x.lbl : "???");
      })
      .catch(e => popup(element, title, e.message));
    return true;
  }
}
// extensionList.add(new Hpp(location));

// requires CORS headers at schema site; pretty unlikely
class DereferenceSchema {
  constructor (base) {
    this.sparql = new Comunica.QueryEngine();
    this.fetches = new Map();
  }
  adopt (targetUrlStr, element, title, popup) {
    const docUrl = new URL(targetUrlStr);
    docUrl.fragment = null;
    const docUrlStr = docUrl.href;
    if (!this.fetches.has(docUrlStr))
      this.fetches.set(docUrlStr, fetch(docUrlStr, {headers: {redirect: 'follow', accept: 'text/turtle'} }).then(
        async resp => {
          const body = await resp.text();
          return {docUrl, resp, body};
        },
        err => {
          return {docUrl, err};
        }
      ));

    popup(element, title, async () => {
      const x = await this.fetches(docUrl);
      return `{{docUrl}}`;
    });
  }
}
// extensionList.add(new DereferenceSchema(location)); // should be at bottom as it accepts everything

const Elts = {
  pageInput: document.querySelector('#page input'),
  renderElement: document.querySelector('.clickable'),
  messagesList: document.querySelector('#messages ol'),
  popup: document.querySelector('#popup-window'),
  popupTitle: document.querySelector('#popup-window h3'),
  popupLabel: document.querySelector('#popup-window .label'),
  popupDefinition: document.querySelector('#popup-window .definition'),
};

// window.addEventListener("load", onLoad);
document.addEventListener("DOMContentLoaded", onLoad);

function log (className, msg) {
  const li = document.createElement('li');
  li.className = className;
  li.innerText = msg;
  document.querySelector('#messages').prepend(li);
}

async function onLoad (evt) {
  Elts.pageInput.oninput = inputDoc;
  const params = new URLSearchParams(location.search);
  const browse = params.get('browse');
  if (browse) {
    Elts.pageInput.value = browse;
    inputDoc.call(Elts.pageInput, evt);
  }
}

async function inputDoc (evt) {
  if (this.value)
    renderDoc(this.value, document.location.href);
}

async function renderDoc (urlStr, oldBase) {
  const docBase = new URL(urlStr, oldBase);
  const resp = await fetch(docBase);
  const body = await resp.text();
  if (!resp.ok)
    throw Error(`fetch(${urlStr}) => ${resp.code}:\n${body}`);

  message(` ${new URL(urlStr, oldBase).href}`);
  Elts.renderElement.replaceChildren(); // clear out rendering area

  const contentType = resp.headers.get("Content-Type");
  if (contentType && contentType !== 'text/turtle')
    throw Error(`media type ${contentType} not supported; only "text/turtle" for now`);

  const parser = new TurtleParser.TurtleParser({baseIRI: docBase.href});
  const parseTree = parser.parse(body);

  await extensionList.ready();
  new RenderClickableLd(document, {
    sparqlPrefix: {useParent: true},
    skipped: {useParent: true},
    namespace: {useParent: true},
    statementOrWs: {useParent: true},
    BuiltInDatatype: {useParent: true},

    pname: { construct: makeLink.bind(null, docBase) },
    relativeUrl: { construct: makeLink.bind(null, docBase) },
    BLANK_NODE_LABEL: { className: "bnode" },
    ANON: { className: "bnode" },
    // blankNodePropertyList: { className: "blankNodePropertyList123" },
    "blankNodePropertyList/start": { className: "bnode" },
    "blankNodePropertyList/end": { className: "bnode" },
    collection: { className: "bnode" },
    simpleLiteral: { className: "literal" },
    datatypedLiteral: { className: "literal" },
    langTagLiteral: { className: "literal" },
  }).render(parseTree, Elts.renderElement);

  document.title = urlStr;
}

const InternalLinks = new Map();
const el = (sel, par) => (par||document).querySelector(sel);
let elPopup;

function makeLink (referrer, elementType, turtleElement, parentDomElement) {
  const referrUrl = new URL(referrer);
  const targetUrl = new URL(turtleElement.value);
  const targetUrlStr = targetUrl.href;
  const neighbor = referrUrl.protocol === targetUrl.protocol
        && referrUrl.host === targetUrl.host;
  const inDoc = neighbor
        && referrUrl.pathname === targetUrl.pathname
        && referrUrl.search === targetUrl.search;
  const element = document.createElement('a');
  element.setAttribute('href', turtleElement.value);
  if (inDoc) {
    element.classList.add("internalOverride");
    let elements = null;
    if (InternalLinks.has(targetUrlStr)) {
      elements = InternalLinks.get(targetUrlStr);
    } else {
      InternalLinks.set(targetUrlStr, (elements = []));
    }
    elements.push(element);

    element.addEventListener('mouseover', async evt => {
      for (const cousin of elements)
        cousin.classList.add("highlighted");
    });
    element.addEventListener('mouseout', async evt => {
      for (const cousin of elements)
        cousin.classList.remove("highlighted");
    });
  } else if (neighbor) {
    element.classList.add("neighbor");
  } else {
    const title = TurtleJisonContext.exports.origText(turtleElement).join('');
    extensionList.findOwner(targetUrlStr, element, title, popup);
  }
  parentDomElement.append(element);
  element.addEventListener('click', async evt => {
    // evt.stopPropagation();
    // if (!inDoc) return; // follow link
    evt.preventDefault();
  });
  // element.addEventListener('click', (event) => event.preventDefault());
  return element;
}

const CssClass_invisible = "invisible";

function popup (element, title, text, definition) {
  element.dataset.popup="#popup-window";

  element.addEventListener('mouseover', async evt => {
    elTarget = element;
    elPopup = Elts.popup;
    elParent = Elts.popup.parentElement;

    // Position:
    const absX = evt.clientX + window.scrollX;
    const absY = evt.clientY + window.scrollY;

    const bcrParent = elParent.getBoundingClientRect();
    const bcrPopup = elPopup.getBoundingClientRect();

    const maxX = bcrParent.width - bcrPopup.width;
    const maxY = bcrParent.height - bcrPopup.height;

    const x = Math.max(0, Math.min(absX, maxX));
    const y = Math.max(0, Math.min(absY, maxY));

    // Show popup
    Object.assign(elPopup.style, {
      left: `${x}px`,
      top: `${y}px`,
    });

    Elts.popupTitle.innerText = title;
    if (definition) { // don't show both label and definition
      Elts.popupLabel.classList.add(CssClass_invisible);
      Elts.popupDefinition.innerText = typeof text === 'function' ? await definition() : definition;
      Elts.popupDefinition.classList.remove(CssClass_invisible);
    } else {
      Elts.popupDefinition.classList.add(CssClass_invisible);
      Elts.popupLabel.innerText = typeof text === 'function' ? await text() : text;
      Elts.popupLabel.classList.remove(CssClass_invisible);
    }

    elPopup.classList.add("is-active");
  });
  element.addEventListener("mouseout", function() {
    // Elts.popup.style.display = "none";
    Elts.popup.classList.remove("is-active");
  });
}

function message (content) {
  const li = document.createElement('li');
  li.append(content);
  Elts.messagesList.append(li);
}
