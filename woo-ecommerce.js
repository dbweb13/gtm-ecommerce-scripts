(function (run) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})(function () {
  var cfg = window._gtmWooConfig || {};
  var CUSTOM_PRODUCT_PATHS = cfg.customPaths || '';
  var CUSTOM_LIST_PATHS = cfg.customListPaths || '';
  var EXTRA_PRODUCT_LINK_PATHS = cfg.productLinkPaths || '';

  if (window._gtmWooEcommerceDone) return;
  window._gtmWooEcommerceDone = true;

  window.dataLayer = window.dataLayer || [];

  function parsePaths(raw) {
    return (raw || '')
      .split(',')
      .map(function (p) { return p.replace(/\s+/g, '').toLowerCase(); })
      .filter(function (p) { return p.length > 0; });
  }

  function matchPath(value, paths) {
    for (var i = 0; i < paths.length; i++) {
      if (value.indexOf(paths[i]) !== -1) return paths[i];
    }
    return '';
  }

  var path = (window.location.pathname || '').toLowerCase();

  var matchedCustomPath = matchPath(path, parsePaths(CUSTOM_PRODUCT_PATHS));
  var matchedCustomListPath = matchedCustomPath ? '' : matchPath(path, parsePaths(CUSTOM_LIST_PATHS));
  var isCustomProduct = matchedCustomPath !== '';
  var isCustomList = matchedCustomListPath !== '';

  var body = document.body;
  var classList = ((body && body.className) || '').replace(/\s+/g, ' ');

  function hasClass(name) {
    return (' ' + classList + ' ').indexOf(' ' + name + ' ') !== -1;
  }

  var PRODUCT_LINK_PATHS = ['/product/', '/produkt/', '/produs/', '/producto/', '/produto/',
    '/prodotto/', '/produit/', '/proizvod/', '/tovar/'].concat(parsePaths(EXTRA_PRODUCT_LINK_PATHS));

  var PRODUCT_LINK_SELECTOR = 'a.woocommerce-LoopProduct-link, a.woocommerce-loop-product__link, ' +
    PRODUCT_LINK_PATHS.map(function (p) {
      return 'a[href*="' + p.replace(/["\\]/g, '') + '"]';
    }).join(', ');

  var CARD_SELECTOR = '.type-product, li.product, .products .product, .wc-block-grid__product, .wc-block-product';

  var SEED_SELECTOR = CARD_SELECTOR + ', [data-product_id], [data-product-id], ' + PRODUCT_LINK_SELECTOR;

  var SKIP_SELECTOR = 'header, footer, nav, aside, .menu, .site-header, .site-footer, #masthead, ' +
    '#colophon, .widget-area, .sidebar, #secondary, [role="banner"], [role="navigation"], ' +
    '[role="contentinfo"], [role="complementary"], [data-elementor-type="header"], ' +
    '[data-elementor-type="footer"], .elementor-location-header, .elementor-location-footer, ' +
    '.woocommerce-mini-cart, .widget_shopping_cart, .cart_list, .product_list_widget, ' +
    '.elementor-menu-cart__container, .xoo-wsc-modal, .xoo-wsc-container, .fkcart-modal, ' +
    '.xt_woofc, .woofc-area, .cc-window, .vi-wcaio-sidebar-cart';

  var TITLE_CLASS_SELECTORS = ['.woocommerce-loop-product__title', '.wc-block-grid__product-title',
    '.wp-block-post-title', '.product-title', '.product_title', '.product-name'];

  var TITLE_GENERIC_SELECTORS = ['h2', 'h3', 'h4', 'h1', 'h5', 'h6', '.name', '.title',
    '[class*="title"]', '[class*="name"]'];

  var PRICE_SELECTOR = '.woocommerce-Price-amount, [itemprop="price"]';

  var isSingleClass = hasClass('single-product');
  var isProductArchive = !isSingleClass && (
    hasClass('woocommerce') || hasClass('post-type-archive-product') ||
    hasClass('woocommerce-shop') || /(^| )tax-product_/.test(classList)
  );

  var isExcludedPage =
    ((hasClass('home') || hasClass('front-page')) && !isProductArchive) ||
    hasClass('woocommerce-cart') || hasClass('woocommerce-checkout') || hasClass('woocommerce-account');

  var gateCards = null;
  var isListCandidate = !isExcludedPage && (isProductArchive || (gateCards = findCards()).length > 0);

  if (!isCustomProduct && !isCustomList && !isSingleClass && !isListCandidate) return;

  var isSingleProduct = isCustomProduct || (!isCustomList && isSingleClass);
  var isListPage = !isSingleProduct;

  function cleanText(value) {
    return value ? String(value).replace(/\s+/g, ' ').trim() : '';
  }

  function parsePrice(value) {
    if (!value) return 0;

    var text = String(value)
      .replace(/\s/g, '')
      .replace(/[^0-9.,]/g, '');

    if (!text) return 0;

    var lastComma = text.lastIndexOf(',');
    var lastDot = text.lastIndexOf('.');

    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) {
        text = text.replace(/\./g, '').replace(',', '.');
      } else {
        text = text.replace(/,/g, '');
      }
    } else if (lastComma > -1) {
      text = text.replace(',', '.');
    }

    var price = parseFloat(text);
    return isNaN(price) ? 0 : price;
  }

  function getCurrency() {
    var currency =
      document.querySelector('meta[property="product:price:currency"]') ||
      document.querySelector('meta[itemprop="priceCurrency"]');

    if (currency && currency.content) return currency.content;

    return 'EUR';
  }

  function getJsonLdProduct() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (var i = 0; i < scripts.length; i++) {
      try {
        var json = JSON.parse(scripts[i].innerText);

        if (Array.isArray(json)) {
          for (var a = 0; a < json.length; a++) {
            if (json[a] && json[a]['@type'] === 'Product') return json[a];
          }
        }

        if (json && json['@type'] === 'Product') return json;

        if (json && json['@graph']) {
          for (var g = 0; g < json['@graph'].length; g++) {
            if (json['@graph'][g] && json['@graph'][g]['@type'] === 'Product') {
              return json['@graph'][g];
            }
          }
        }
      } catch (e) {}
    }

    return {};
  }

  function getBestPriceFromContainer(container) {
    if (!container) return 0;

    var metaPrice =
      container.querySelector('meta[itemprop="price"]') ||
      container.querySelector('[itemprop="price"]');

    if (metaPrice) {
      if (metaPrice.content) return parsePrice(metaPrice.content);
      if (metaPrice.getAttribute('content')) return parsePrice(metaPrice.getAttribute('content'));
    }

    var priceEl =
      container.querySelector('.price ins .woocommerce-Price-amount bdi') ||
      container.querySelector('.price ins .woocommerce-Price-amount') ||
      container.querySelector('ins .woocommerce-Price-amount bdi') ||
      container.querySelector('ins .woocommerce-Price-amount') ||
      container.querySelector('.price > .woocommerce-Price-amount bdi') ||
      container.querySelector('.price > .woocommerce-Price-amount') ||
      container.querySelector('.summary .price .woocommerce-Price-amount bdi') ||
      container.querySelector('.summary .price .woocommerce-Price-amount') ||
      container.querySelector('.woocommerce-Price-amount bdi') ||
      container.querySelector('.woocommerce-Price-amount');

    if (!priceEl) return 0;

    if (
      priceEl.closest('del') ||
      priceEl.closest('.price-euro') ||
      priceEl.classList.contains('price-euro')
    ) {
      return 0;
    }

    return parsePrice(priceEl.innerText || priceEl.textContent);
  }

  function customSlug() {
    return matchedCustomPath.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
  }

  function getProductIdFromPage() {
    if (isCustomProduct) {
      return customSlug() || 'custom-product';
    }

    var productId = '';

    var atcEl = document.querySelector('[name="add-to-cart"]');
    if (atcEl && atcEl.value) productId = atcEl.value;

    if (!productId || productId === '0') {
      var idMatch = classList.match(/postid-(\d+)/);
      if (idMatch) productId = idMatch[1];
    }

    if (!productId) {
      var formCart = document.querySelector('form.cart');
      if (formCart && formCart.dataset && formCart.dataset.product_id) {
        productId = formCart.dataset.product_id;
      }
    }

    if (!productId) {
      var metaPid = document.querySelector('meta[itemprop="productID"]');
      if (metaPid) productId = metaPid.content;
    }

    return productId || 'unknown';
  }

  function getProductNameFromPage(jsonLd) {
    var titleEl =
      document.querySelector('h1.product_title.entry-title') ||
      document.querySelector('.product_title') ||
      document.querySelector('h1');

    if (titleEl) return cleanText(titleEl.innerText);

    if (jsonLd && jsonLd.name) return cleanText(jsonLd.name);

    if (document.title) return cleanText(document.title.split(' – ')[0]);

    return 'Unknown Product';
  }

  function getProductPriceFromPage(jsonLd) {
    if (jsonLd && jsonLd.offers) {
      if (Array.isArray(jsonLd.offers) && jsonLd.offers[0]) {
        if (jsonLd.offers[0].price) return parsePrice(jsonLd.offers[0].price);
        if (jsonLd.offers[0].lowPrice) return parsePrice(jsonLd.offers[0].lowPrice);
      }

      if (jsonLd.offers.price) return parsePrice(jsonLd.offers.price);
      if (jsonLd.offers.lowPrice) return parsePrice(jsonLd.offers.lowPrice);
    }

    return getBestPriceFromContainer(document);
  }

  function getProductSku(jsonLd) {
    if (jsonLd && jsonLd.sku) return cleanText(jsonLd.sku);

    var sku = document.querySelector('.sku');
    if (sku) return cleanText(sku.innerText);

    return '';
  }

  function getProductBrand(jsonLd) {
    if (!jsonLd || !jsonLd.brand) return '';

    if (typeof jsonLd.brand === 'string') return cleanText(jsonLd.brand);
    if (jsonLd.brand.name) return cleanText(jsonLd.brand.name);

    return '';
  }

  function getProductImage(jsonLd) {
    if (jsonLd && jsonLd.image) {
      if (typeof jsonLd.image === 'string') return jsonLd.image;

      if (Array.isArray(jsonLd.image) && jsonLd.image.length) {
        if (typeof jsonLd.image[0] === 'string') return jsonLd.image[0];
        if (jsonLd.image[0].url) return jsonLd.image[0].url;
      }
    }

    var img =
      document.querySelector('.woocommerce-product-gallery img') ||
      document.querySelector('.product img');

    return img ? (img.currentSrc || img.src || '') : '';
  }

  function addCategoriesToItem(item) {
    var cats = [];

    var breadcrumbLinks = document.querySelectorAll(
      '.woocommerce-breadcrumb a, nav.woocommerce-breadcrumb a'
    );

    for (var i = 0; i < breadcrumbLinks.length; i++) {
      var txt = cleanText(breadcrumbLinks[i].innerText);

      if (txt && !/home|начало|homepage/i.test(txt)) {
        cats.push(txt);
      }
    }

    if (!cats.length) {
      var metaCats = document.querySelectorAll('.product_meta .posted_in a, .posted_in a');

      for (var m = 0; m < metaCats.length; m++) {
        var cat = cleanText(metaCats[m].innerText);
        if (cat) cats.push(cat);
      }
    }

    if (!cats.length && isCustomProduct) {
      var slug = customSlug().replace(/-/g, ' ');
      if (slug) cats.push(slug);
    }

    for (var c = 0; c < cats.length && c < 5; c++) {
      item[c === 0 ? 'item_category' : 'item_category' + (c + 1)] = cats[c];
    }

    return item;
  }

  function pushViewItem() {
    var jsonLd = getJsonLdProduct();
    var price = getProductPriceFromPage(jsonLd);
    var productName = getProductNameFromPage(jsonLd);

    var item = {
      item_id: getProductIdFromPage(),
      item_name: productName,
      item_brand: getProductBrand(jsonLd),
      item_sku: getProductSku(jsonLd),
      price: price,
      imageUrl: getProductImage(jsonLd),
      affiliation: window.location.hostname,
      quantity: 1
    };

    item = addCategoriesToItem(item);

    var isVariable = !isCustomProduct && typeof wc_add_to_cart_variation_params !== 'undefined';

    if (isVariable) {
      var varForm = document.querySelector('.variations_form');

      if (varForm && varForm.dataset && varForm.dataset.product_variations) {
        try {
          var variations = JSON.parse(varForm.dataset.product_variations);
          var defaultVar = null;

          for (var i = 0; i < variations.length; i++) {
            if (variations[i].is_default === true) {
              defaultVar = variations[i];
              break;
            }
          }

          if (!defaultVar && variations.length > 0) defaultVar = variations[0];

          if (defaultVar) {
            var varPrice = parseFloat(defaultVar.display_price) || price;
            var attrs = [];

            for (var key in defaultVar.attributes) {
              if (defaultVar.attributes.hasOwnProperty(key) && defaultVar.attributes[key]) {
                attrs.push(defaultVar.attributes[key]);
              }
            }

            item.item_id = defaultVar.variation_id.toString();
            item.item_variant = attrs.join(' • ');
            item.price = varPrice;
            price = varPrice;
          }
        } catch (e) {}
      }

      if (typeof jQuery !== 'undefined') {
        jQuery(document.body).on('found_variation', function (ev, variation) {
          dataLayer.push({ ecommerce: null });

          var varAttrs = [];

          for (var k in variation.attributes) {
            if (variation.attributes.hasOwnProperty(k) && variation.attributes[k]) {
              varAttrs.push(variation.attributes[k]);
            }
          }

          var vItem = {
            item_id: variation.variation_id.toString(),
            item_name: productName,
            item_variant: varAttrs.join(' • '),
            item_brand: item.item_brand,
            item_sku: item.item_sku,
            price: parseFloat(variation.display_price) || 0,
            imageUrl: item.imageUrl,
            affiliation: item.affiliation,
            quantity: 1
          };

          for (var ck in item) {
            if (item.hasOwnProperty(ck) && ck.indexOf('item_category') === 0) {
              vItem[ck] = item[ck];
            }
          }

          dataLayer.push({
            event: 'view_item',
            ecomm_pagetype: 'product',
            ecommerce: {
              currency: getCurrency(),
              value: vItem.price,
              items: [vItem]
            }
          });
        });
      }
    }

    dataLayer.push({ ecommerce: null });
    dataLayer.push({
      event: 'view_item',
      ecomm_pagetype: 'product',
      ecommerce: {
        currency: getCurrency(),
        value: price,
        items: [item]
      }
    });
  }

  function getListName() {
    var listNameEl = document.querySelector(
      'h1.page-title, .entry-title, .woocommerce-products-header__title, .archive-title, h1'
    );

    if (listNameEl) return cleanText(listNameEl.innerText);

    if (document.title) return cleanText(document.title.split(' – ')[0]);

    return 'Product List';
  }

  function getListId() {
    if (isCustomList) {
      return matchedCustomListPath.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
    }

    var match = classList.match(/term-(\d+)/);
    if (match && match[1]) return match[1];

    return '';
  }

  function getProductCardCategory(product) {
    var pCat = '';
    var pCatEl = product.querySelector('[class*="category"], .posted_in, .product_cat');

    if (pCatEl) pCat = cleanText(pCatEl.innerText);

    return pCat;
  }

  function getProductCardImage(product) {
    var img = product.querySelector('img');
    return img ? (img.currentSrc || img.src || '') : '';
  }

  function inSkippedArea(el) {
    var area = el.closest(SKIP_SELECTOR);
    return !!area && area !== document.body && area !== document.documentElement;
  }

  function linkKey(a) {
    return (a.getAttribute('href') || '')
      .replace(/^[a-z]+:\/\/[^\/]+/i, '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  }

  function holdsOneProduct(el) {
    var seen = {};
    var ids = 0;
    var urls = 0;
    var idEls = el.querySelectorAll('[data-product_id], [data-product-id]');
    var linkEls = el.querySelectorAll(PRODUCT_LINK_SELECTOR);

    for (var i = 0; i < idEls.length; i++) {
      var id = 'id:' + (idEls[i].getAttribute('data-product_id') || idEls[i].getAttribute('data-product-id'));
      if (!seen[id]) { seen[id] = true; ids++; }
    }
    for (var j = 0; j < linkEls.length; j++) {
      var url = 'url:' + linkKey(linkEls[j]);
      if (!seen[url]) { seen[url] = true; urls++; }
    }

    return ids <= 1 && urls <= 1;
  }

  function firstText(root, selectors, filter) {
    for (var i = 0; i < selectors.length; i++) {
      var els = root.querySelectorAll(selectors[i]);
      for (var j = 0; j < els.length; j++) {
        var text = cleanText(els[j].innerText || els[j].textContent);
        if (text && (!filter || filter(els[j]))) return text;
      }
    }
    return '';
  }

  function isLinkedTitle(el) {
    return !!(el.querySelector(PRODUCT_LINK_SELECTOR) || el.closest(PRODUCT_LINK_SELECTOR));
  }

  function getLinkText(card) {
    var links = card.querySelectorAll(PRODUCT_LINK_SELECTOR);
    var i;
    var text;

    for (i = 0; i < links.length; i++) {
      text = cleanText(links[i].innerText || links[i].textContent);
      if (text) return text;
    }
    for (i = 0; i < links.length; i++) {
      var img = links[i].querySelector('img');
      text = cleanText(links[i].getAttribute('title') || links[i].getAttribute('aria-label') ||
        (img && img.getAttribute('alt')) || '');
      if (text) return text;
    }
    return '';
  }

  function isShown(el) {
    if (!el.getClientRects().length) return false;
    var rect = el.getBoundingClientRect();
    return rect.right > 0 && rect.left < (window.innerWidth || document.documentElement.clientWidth);
  }

  function getCardName(card) {
    return firstText(card, TITLE_CLASS_SELECTORS) ||
      firstText(card, TITLE_GENERIC_SELECTORS, isLinkedTitle) ||
      firstText(card, TITLE_GENERIC_SELECTORS) ||
      getLinkText(card);
  }

  function climbToCard(seed) {
    var card = null;

    for (var el = seed.parentElement; el && el !== document.body; el = el.parentElement) {
      if (!holdsOneProduct(el) || cleanText(el.textContent).length > 600) break;
      card = el;
    }

    if (!card) return null;

    var hasPrice = !!card.querySelector(PRICE_SELECTOR);
    var accept =
      firstText(card, TITLE_CLASS_SELECTORS) ||
      firstText(card, TITLE_GENERIC_SELECTORS, isLinkedTitle) ||
      (hasPrice && (firstText(card, TITLE_GENERIC_SELECTORS) || getLinkText(card)));

    return accept ? card : null;
  }

  function insideAny(cards, el) {
    for (var i = 0; i < cards.length; i++) {
      if (cards[i] !== el && cards[i].contains(el)) return true;
    }
    return false;
  }

  function findCards() {
    var seeds = document.querySelectorAll(SEED_SELECTOR);
    var cards = [];

    for (var i = 0; i < seeds.length; i++) {
      if (insideAny(cards, seeds[i]) || inSkippedArea(seeds[i])) continue;

      var card = seeds[i].closest(CARD_SELECTOR) || climbToCard(seeds[i]);
      if (card && cards.indexOf(card) === -1 && isShown(card)) cards.push(card);
    }

    return cards.filter(function (card) {
      for (var k = 0; k < cards.length; k++) {
        if (cards[k] !== card && cards[k].contains(card)) return false;
      }
      return true;
    });
  }

  function getCardId(card, name) {
    var idEl = card.matches('[data-product_id], [data-product-id]') ? card :
      card.querySelector('[data-product_id], [data-product-id]');
    var id = idEl ? (idEl.getAttribute('data-product_id') || idEl.getAttribute('data-product-id')) : '';

    if (!id) {
      var postMatch = (' ' + card.className + ' ').match(/\spost-(\d+)\s/);
      if (postMatch) id = postMatch[1];
    }

    if (!id) {
      var ctxEl = card.matches('[data-wc-context]') ? card : card.querySelector('[data-wc-context]');
      var ctxMatch = ctxEl && (ctxEl.getAttribute('data-wc-context') || '').match(/"productId"\s*:\s*"?(\d+)/);
      if (ctxMatch) id = ctxMatch[1];
    }

    if (!id) {
      var postEl = card.matches('[data-post-id]') ? card : card.querySelector('[data-post-id]');
      var postId = postEl ? postEl.getAttribute('data-post-id') : '';
      if (/^\d+$/.test(postId || '')) id = postId;
    }

    if (!id && /^product-\d+$/.test(card.id || '')) id = card.id.replace('product-', '');

    if (!id) {
      var link = card.querySelector(PRODUCT_LINK_SELECTOR);
      id = link ? linkKey(link).split('/').pop() : '';
      try { id = decodeURIComponent(id); } catch (e) {}
    }

    return id || name.toLowerCase().replace(/\s+/g, '-');
  }

  var listPushed = false;

  function pushViewItemList() {
    if (listPushed) return true;

    var cards = gateCards || findCards();
    gateCards = null;
    if (!cards.length) return false;

    var listName = getListName();
    var listId = getListId();
    var items = [];
    var seenIds = {};

    for (var i = 0; i < cards.length; i++) {
      var name = getCardName(cards[i]);
      if (!name) continue;

      var id = String(getCardId(cards[i], name));
      if (seenIds[id]) continue;
      seenIds[id] = true;

      items.push({
        item_id: id,
        item_name: name,
        item_category: getProductCardCategory(cards[i]),
        price: getBestPriceFromContainer(cards[i]),
        imageUrl: getProductCardImage(cards[i]),
        item_list_id: listId,
        item_list_name: listName,
        index: items.length + 1,
        quantity: 1
      });
    }

    if (!items.length) return false;

    listPushed = true;
    dataLayer.push({ ecommerce: null });
    dataLayer.push({
      event: 'view_item_list',
      ecomm_pagetype: 'category',
      ecommerce: {
        currency: getCurrency(),
        items: items
      }
    });

    return true;
  }

  if (isSingleProduct) {
    if (isCustomProduct || document.querySelector('.product_title, .price')) {
      pushViewItem();
    } else {
      var obs = new MutationObserver(function (mutations, ob) {
        if (document.querySelector('.product_title, .price')) {
          ob.disconnect();
          pushViewItem();
        }
      });

      obs.observe(body, { childList: true, subtree: true });

      setTimeout(function () {
        obs.disconnect();
        pushViewItem();
      }, 8000);
    }

  } else if (isListPage) {
    if (!pushViewItemList()) {
      var listTimer = null;
      var listObs = new MutationObserver(function (mutations, ob) {
        if (listTimer) return;
        listTimer = setTimeout(function () {
          listTimer = null;
          if (pushViewItemList()) ob.disconnect();
        }, 250);
      });

      listObs.observe(body, { childList: true, subtree: true });

      setTimeout(function () {
        listObs.disconnect();
      }, 10000);
    }
  }
});
