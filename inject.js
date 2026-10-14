// Iniettato in ogni pagina HTML del sito proxato.
// Modifica SELECTORS e ricarica la pagina (il server rilegge il file a ogni richiesta).
(function () {
  var SELECTORS = [
    'header',
    'footer',
    '.announcement-bar',
    '#shopify-section-header',
    '#shopify-section-footer',
    // Prezzi prodotti (tema Shopify di relievum.it)
    '.product__price',          // card prodotto in collezione
    '.card-product-price',      // contenitore prezzo card
    '.block-product__price',    // pagina prodotto
    '.price-regular',
    '.price-item',
    '.compare-price',
    '.special-price',
    // Filtro prezzo nella sidebar (mostra "Il prezzo più alto è €...")
    'action-filter:has(.price-range)',
    '.facets__price',
    '.price-range',
  ];

  // Contenitori del carrello (drawer laterale + pagina /cart).
  // Qui gli elementi NON vengono rimossi ma svuotati/nascosti: il JS del tema
  // li cerca con querySelector a ogni aggiornamento e andrebbe in errore.
  var CART_CONTAINERS = [
    '[id*="cart-drawer"]',
    '.overlay-cart',
    '.cart-drawer__form',
    '[id*="cart-items"]',
    '#MainCartItems',
    '.cart-page',
    '.main-cart__wrapper',
    '[id*="main-cart"]',
    '.free-shipping-bar',
    '.total-price__detail',
  ];

  // Testo che è solo un prezzo: "€218,00", "Da €99", "1.250,00 €"
  var PRICE_TEXT = /^\s*(da\s*)?(€\s*[\d.,]+|[\d.,]+\s*€)\s*$/i;
  // Importo dentro un testo: "Totale €218,00 EUR", "Ti mancano 20,00€"
  var PRICE_IN_TEXT = /€\s*\d[\d.,]*(\s*EUR)?|\d[\d.,]*\s*(€|EUR\b)/gi;
  var HIDDEN_CLASS = 'rlv-price-hidden';

  // CSS: nasconde subito, prima del render (niente flash)
  var style = document.createElement('style');
  // Una regola per selettore: se uno non è supportato non invalida gli altri
  style.textContent = SELECTORS.map(function (sel) {
    return sel + '{display:none!important}';
  }).join('\n') + '\n.' + HIDDEN_CLASS + '{display:none!important}';
  document.documentElement.appendChild(style);

  function inCart(el) {
    return CART_CONTAINERS.some(function (sel) {
      try { return !!el.closest(sel); } catch (e) { return false; }
    });
  }

  // Carrello: toglie gli importi dal testo e nasconde gli elementi rimasti vuoti
  function stripCartPrices() {
    CART_CONTAINERS.forEach(function (sel) {
      var roots;
      try { roots = document.querySelectorAll(sel); } catch (e) { return; }
      roots.forEach(function (root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
          var parent = node.parentElement;
          if (!parent || /^(SCRIPT|STYLE|TEMPLATE)$/.test(parent.tagName)) continue;
          PRICE_IN_TEXT.lastIndex = 0;
          if (!PRICE_IN_TEXT.test(node.nodeValue)) continue;
          node.nodeValue = node.nodeValue.replace(PRICE_IN_TEXT, '');
          if (!parent.textContent.trim() && !parent.querySelector('img,svg,input,button,select')) {
            parent.classList.add(HIDDEN_CLASS);
          }
        }
      });
    });
  }

  // Fallback: rimuove elementi foglia il cui testo è solo un prezzo
  // (prezzi senza classe nota, es. carrello, prodotti consigliati)
  function removePriceText() {
    if (!document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var targets = [];
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentElement;
      if (!parent || /^(SCRIPT|STYLE|TEMPLATE|OPTION)$/.test(parent.tagName)) continue;
      if (PRICE_TEXT.test(parent.textContent) && !inCart(parent)) targets.push(parent);
    }
    targets.forEach(function (el) { el.remove(); });
  }

  // DOM: rimuove gli elementi, anche quelli aggiunti dopo da JS
  function clean() {
    SELECTORS.forEach(function (sel) {
      try {
        document.querySelectorAll(sel).forEach(function (el) { el.remove(); });
      } catch (e) { /* selettore non supportato */ }
    });
    stripCartPrices();
    removePriceText();
  }
  // characterData: il tema aggiorna i totali anche cambiando solo il testo
  new MutationObserver(clean).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  document.addEventListener('DOMContentLoaded', clean);
})();
