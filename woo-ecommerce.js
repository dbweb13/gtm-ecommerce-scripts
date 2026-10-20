/*
 * WooCommerce Ecommerce DataLayer — companion script
 * Loaded by the "WooCommerce Ecommerce DataLayer" GTM custom template.
 *
 * Reads its config from window._gtmWooConfig (set by the template before injection):
 *   window._gtmWooConfig = {
 *     customPaths: "/print-stakla,/custom-glass",   // → view_item
 *     customListPaths: "/promocii",                 // → view_item_list
 *     productLinkPaths: ""                          // optional extra product URL bases
 *   }
 *
 * Host this first-party (e.g. via your Cloudflare Worker) and point the template's
 * "Tracking script URL" field at it. No edits needed per account — the custom paths
 * come from the template field.
 *
 * v1.1.0 — fire the template on the built-in "All Pages" trigger. The script waits for
 * DOM ready itself and only runs on single-product pages, product list archives that
 * contain a product grid, and the custom paths. No extra variables/triggers needed.
 *
 * v1.2.0 — universal list detection: product cards are found on any theme/builder —
 * WooCommerce loops (ul.products / .products), Blocks, Elementor Loop, Flatsome,
 * WoodMart…, add-to-cart buttons (data-product_id) and product links (/product/,
 * /produkt/ …). Header, menus, footer, sidebars and mini/side carts are ignored;
 * home (unless it is the shop), cart, checkout and account pages never push lists.
 * Custom list paths force view_item_list (product paths win when both match).
 *
 * v1.2.1 — custom cards without prices (image + heading + "learn more" button,
 * e.g. manufacturer catalogs) are recognised; the same product shown in a tab or
 * banner and in the grid is counted once (grid card wins).
 *
 * v1.2.2 — variable products: view_item uses the pre-selected (default) variation,
 * or the parent product when nothing is selected (was: always the first variation);
 * WooCommerce's own found_variation for that default no longer pushes a duplicate.
 * Safety net: when the detection finds nothing, the logic of the previous Custom
 * HTML tags runs (grid-based, then /produkt/-link-based) on the same pages their
 * cjs variables allowed — so the template never finds less than they did.
 */
(function (run) {
  // Tag may fire on gtm.js (All Pages) → wait until the DOM is parsed.
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

  // Product paths win when a URL matches both lists.
  var matchedCustomPath = matchPath(path, parsePaths(CUSTOM_PRODUCT_PATHS));
  var matchedCustomListPath = matchedCustomPath ? '' : matchPath(path, parsePaths(CUSTOM_LIST_PATHS));
  var isCustomProduct = matchedCustomPath !== '';
  var isCustomList = matchedCustomListPath !== '';

  var body = document.body;
  var classList = ((body && body.className) || '').replace(/\s+/g, ' ');

  function hasClass(name) {
    return (' ' + classList + ' ').indexOf(' ' + name + ' ') !== -1;
  }

  // ── Product card detection (universal) ─────────────────────────────────────
  // A card is a WooCommerce / Blocks / builder product item, or — for custom
  // markup — the block around an add-to-cart button or product link that holds
  // only that one product. See findCards().
  var PRODUCT_LINK_PATHS = ['/product/', '/produkt/', '/produs/', '/producto/', '/produto/',
    '/prodotto/', '/produit/', '/proizvod/', '/tovar/'].concat(parsePaths(EXTRA_PRODUCT_LINK_PATHS));

  var PRODUCT_LINK_SELECTOR = 'a.woocommerce-LoopProduct-link, a.woocommerce-loop-product__link, ' +
    PRODUCT_LINK_PATHS.map(function (p) {
      return 'a[href*="' + p.replace(/["\\]/g, '') + '"]';
    }).join(', ');

  var CARD_SELECTOR = '.type-product, li.product, .products .product, .wc-block-grid__product, .wc-block-product';

  var SEED_SELECTOR = CARD_SELECTOR + ', [data-product_id], [data-product-id], ' + PRODUCT_LINK_SELECTOR;

  // Site chrome is never a product list: header, menus, footer, sidebars, mini/side carts.
  var SKIP_SELECTOR = 'header, footer, nav, aside, .menu, .site-header, .site-footer, #masthead, ' +
    '#colophon, .widget-area, .sidebar, #secondary, [role="banner"], [role="navigation"], ' +
    '[role="contentinfo"], [role="complementary"], [data-elementor-type="header"], ' +
    '[data-elementor-type="footer"], .elementor-location-header, .elementor-location-footer, ' +
    '.woocommerce-mini-cart, .widget_shopping_cart, .cart_list, .product_list_widget, ' +
    '.elementor-menu-cart__container, .xoo-wsc-modal, .xoo-wsc-container, .fkcart-modal, ' +
    '.xt_woofc, .woofc-area, .cc-window, .vi-wcaio-sidebar-cart';

  var TITLE_CLASS_SELECTORS = ['.woocommerce-loop-product__title', '.wc-block-grid__product-title',
    '.wp-block-post-title', '.product-title', '.product_title', '.product-name'];

  var TITLE_GENERIC_SELECTORS = ['h2', 'h3', 'h4', 'h5', 'h6', '.name', '.title',
    '[class*="title"]', '[class*="name"]'];

  var PRICE_SELECTOR = '.woocommerce-Price-amount, [itemprop="price"]';

  var IMAGE_SELECTOR = 'img, picture, [style*="background-image"]';

  var TITLE_COUNT_SELECTOR = 'h2, h3, h4, h5, h6, ' + TITLE_CLASS_SELECTORS.join(', ');

  // ── Page gate — replaces the old "cjs - ecommerce.product_page" variable + trigger.
  var isSingleClass = hasClass('single-product');
  var isProductArchive = !isSingleClass && (
    hasClass('woocommerce') || hasClass('post-type-archive-product') ||
    hasClass('woocommerce-shop') || /(^| )tax-product_/.test(classList)
  );

  // Home (unless it is the shop), cart, checkout and account pages are never lists.
  var isExcludedPage =
    ((hasClass('home') || hasClass('front-page')) && !isProductArchive) ||
    hasClass('woocommerce-cart') || hasClass('woocommerce-checkout') || hasClass('woocommerce-account');

  // Blog posts: only real WooCommerce/Blocks grids count, never cards guessed
  // from links in the article.
  var allowClimb = !hasClass('single-post');

  // Pages your old cjs variables let through (parity): an archive with a WooCommerce
  // grid (cjs v1) or any page with a product link (cjs v2, /produkt/ sites).
  var hasOldGrid =
    /\b(archive|post-type-archive-product|tax-product_cat|tax-product_tag|woocommerce-shop)\b/.test(classList) &&
    !!document.querySelector('.products, ul.products, .woocommerce-products');
  var hasProductLinks = allowClimb && !!document.querySelector(PRODUCT_LINK_SELECTOR);

  // Outside shop/category pages one detected card alone is a promo, not a list.
  var minCards = isProductArchive || isCustomList || hasOldGrid ? 1 : 2;

  // Shop / product taxonomy pages always qualify (grid may load later); any other
  // page qualifies when it shows product cards or product links.
  var gateCards = null;
  var isListCandidate = !isExcludedPage &&
    (isProductArchive || hasOldGrid || hasProductLinks || (gateCards = findCards()).length >= minCards);

  if (!isCustomProduct && !isCustomList && !isSingleClass && !isListCandidate) return;

  // Custom paths override the body-class detection.
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
    // Custom (non-Woo) product page → derive a stable id from the configured path.
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

    // Custom (non-Woo) page fallback → use the path slug so the item still has a category.
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

    // ── Variable product support (inherited from site 2). ─────────────
    // Auto-gated: inert on sites without WooCommerce variable products,
    // and skipped entirely on custom (non-Woo) pages.
    var varForm = document.querySelector('.variations_form');
    var isVariable = !isCustomProduct &&
      (typeof wc_add_to_cart_variation_params !== 'undefined' || !!varForm);
    var lastVariationId = '';

    if (isVariable) {
      if (varForm && varForm.dataset && varForm.dataset.product_variations) {
        try {
          var variations = JSON.parse(varForm.dataset.product_variations) || [];
          var selects = varForm.querySelectorAll('select[name^="attribute_"]');
          var selected = {};
          var allSelected = selects.length > 0;
          var defaultVar = null;

          for (var si = 0; si < selects.length; si++) {
            selected[selects[si].name] = selects[si].value;
            if (!selects[si].value) allSelected = false;
          }

          // Only the pre-selected (default) variation; nothing selected → parent product.
          for (var i = 0; allSelected && !defaultVar && i < variations.length; i++) {
            var matches = true;
            for (var an in selected) {
              var va = variations[i].attributes && variations[i].attributes[an];
              if (va && va !== selected[an]) { matches = false; break; }
            }
            if (matches) defaultVar = variations[i];
          }

          if (defaultVar) {
            var varPrice = parseFloat(defaultVar.display_price) || price;
            var attrs = [];

            for (var key in defaultVar.attributes) {
              if (defaultVar.attributes.hasOwnProperty(key) && (defaultVar.attributes[key] || selected[key])) {
                attrs.push(defaultVar.attributes[key] || selected[key]);
              }
            }

            item.item_id = defaultVar.variation_id.toString();
            item.item_variant = attrs.join(' • ');
            item.price = varPrice;
            price = varPrice;
            lastVariationId = item.item_id;
          }
        } catch (e) {}
      }

      if (typeof jQuery !== 'undefined') {
        jQuery(document.body).on('found_variation', function (ev, variation) {
          // WooCommerce also fires this for the pre-selected variation → already pushed.
          if (!variation || String(variation.variation_id) === lastVariationId) return;
          lastVariationId = String(variation.variation_id);

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

          // Carry over any resolved categories from the base item.
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
    // Custom list page → stable id from the configured path.
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

  // Product URL without domain / query / hash / trailing slash.
  function linkKey(a) {
    return (a.getAttribute('href') || '')
      .replace(/^[a-z]+:\/\/[^\/]+/i, '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  }

  // True while the block contains at most one product id and one product URL —
  // i.e. we haven't climbed out of the card into the grid.
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

  // display:none blocks (hidden drawers, other breakpoint) and off-canvas panels don't count.
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

  // Inline link inside a text paragraph (blog/content) — not a product card.
  function isProseLink(el) {
    var block = el.closest('p, td, dd, blockquote');
    return !!block && cleanText(block.textContent).length - cleanText(el.textContent).length > 80;
  }

  // A card needs a name (title, or link text next to a price) and an image or a
  // price — catalogs without prices (image + heading + "learn more") included.
  function isAcceptableCard(el) {
    var hasPrice = !!el.querySelector(PRICE_SELECTOR);
    if (!hasPrice && !el.querySelector(IMAGE_SELECTOR)) return false;
    return !!(firstText(el, TITLE_CLASS_SELECTORS) || firstText(el, TITLE_GENERIC_SELECTORS) ||
      (hasPrice && getLinkText(el)));
  }

  function tooBig(el) {
    return !holdsOneProduct(el) || cleanText(el.textContent).length > 5000;
  }

  // Custom/builder markup (no WooCommerce card classes).
  function climbToCard(seed) {
    var card = null;
    var el;

    // 1) Smallest block around the link/button that looks like a card.
    for (el = seed.parentElement; el && el !== document.body; el = el.parentElement) {
      if (tooBig(el)) return null;
      if (isAcceptableCard(el)) { card = el; break; }
    }
    if (!card) return null;

    // 2) Grow it to the whole card (price, button…): stop at the grid (another
    //    product) or when the parent brings another title or image (section header, banner).
    var titles = card.querySelectorAll(TITLE_COUNT_SELECTOR).length;
    var images = card.querySelectorAll(IMAGE_SELECTOR).length;

    for (el = card.parentElement; el && el !== document.body; el = el.parentElement) {
      if (tooBig(el) ||
          el.querySelectorAll(TITLE_COUNT_SELECTOR).length > titles ||
          el.querySelectorAll(IMAGE_SELECTOR).length > images) break;
      card = el;
    }

    return card;
  }

  // Seed already inside a found card (image link, title, button of the same product).
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

      var card = seeds[i].closest(CARD_SELECTOR);
      if (!card && allowClimb && !isProseLink(seeds[i])) card = climbToCard(seeds[i]);
      if (card && cards.indexOf(card) === -1 && isShown(card)) cards.push(card);
    }

    // Nested matches → keep the outermost card.
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
      // Slug from the product URL, e.g. /produkt/vrata-x/ → vrata-x
      var link = card.querySelector(PRODUCT_LINK_SELECTOR);
      id = link ? linkKey(link).split('/').pop() : '';
      try { id = decodeURIComponent(id); } catch (e) {}
    }

    return id || name.toLowerCase().replace(/\s+/g, '-');
  }

  // ── Fallbacks = your previous Custom HTML tags, used only when the detection
  // above finds nothing, so the template never finds less than they did.

  // Old grid tag (sites with ul.products): first WooCommerce grid → its .product items.
  function getOldGridCards() {
    var grid = document.querySelector(
      '.products, ul.products, .woocommerce-loop-products, .product-grid, .grid.products, ' +
      '.woocommerce-products, .elementor-products-grid, .ast-woo-shop-products'
    );
    return grid ? grid.querySelectorAll('.product, .woocommerce-loop-product, .product-item, .elementor-product') : [];
  }

  // Old link tag (/produkt/ sites): nearest div/li around each product link that has a title.
  function getOldLinkCards() {
    var links = document.querySelectorAll(PRODUCT_LINK_SELECTOR);
    var cards = [];

    for (var i = 0; i < links.length; i++) {
      if (links[i].closest('header, footer, nav')) continue;
      var card = links[i].closest('div, li');
      if (card && card.querySelector('h1, h2, h3, .title') && cards.indexOf(card) === -1) cards.push(card);
    }
    return cards;
  }

  function oldName(selector) {
    return function (card) {
      var el = card.querySelector(selector);
      if (!el) return '';
      return cleanText(el.innerText || el.textContent) || cleanText(el.getAttribute('title') || '');
    };
  }

  function itemsFromCards(cards, nameOf, listId, listName) {
    var items = [];
    var entries = [];
    var best = {};
    var i;

    for (i = 0; i < cards.length; i++) {
      var name = nameOf(cards[i]);
      if (!name) continue;

      var siblings = 0;
      for (var s = 0; s < cards.length; s++) {
        if (cards[s].parentElement === cards[i].parentElement) siblings++;
      }

      entries.push({
        card: cards[i],
        name: name,
        id: String(getCardId(cards[i], name)),
        // Same product in a tab/banner and in the grid → the grid card wins.
        score: (siblings > 1 ? 2 : 0) + (cards[i].querySelector(IMAGE_SELECTOR) ? 1 : 0)
      });
    }

    for (i = 0; i < entries.length; i++) {
      var key = 'id:' + entries[i].id;
      if (!best[key] || entries[i].score > best[key].score) best[key] = entries[i];
    }

    for (i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (best['id:' + entry.id] !== entry) continue;

      items.push({
        item_id: entry.id,
        item_name: entry.name,
        item_category: getProductCardCategory(entry.card),
        price: getBestPriceFromContainer(entry.card),
        imageUrl: getProductCardImage(entry.card),
        item_list_id: listId,
        item_list_name: listName,
        index: items.length + 1,
        quantity: 1
      });
    }

    return items;
  }

  var listPushed = false;

  function pushViewItemList() {
    if (listPushed) return true;

    var cards = gateCards || findCards();
    gateCards = null;

    var listName = getListName();
    var listId = getListId();
    var items = itemsFromCards(cards, getCardName, listId, listName);

    if (items.length < minCards) {
      items = itemsFromCards(getOldGridCards(),
        oldName('.woocommerce-loop-product__title, h2, h3, .product-title, a[title], .title'), listId, listName);
    }
    if (!items.length && allowClimb) {
      items = itemsFromCards(getOldLinkCards(), oldName('h1, h2, h3, .title'), listId, listName);
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
    // Custom pages won't have .product_title/.price → push immediately,
    // no point waiting on the observer.
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
      // Grid rendered later (AJAX / builders) → retry on DOM changes, max ~4×/s.
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
