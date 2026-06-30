/*
 * WooCommerce Ecommerce DataLayer — companion script
 * Loaded by the "WooCommerce Ecommerce DataLayer" GTM custom template.
 *
 * Reads its config from window._gtmWooConfig (set by the template before injection):
 *   window._gtmWooConfig = { customPaths: "/print-stakla,/custom-glass" }
 *
 * Host this first-party (e.g. via your Cloudflare Worker) and point the template's
 * "Tracking script URL" field at it. No edits needed per account — the custom paths
 * come from the template field.
 */
(function () {
  var cfg = window._gtmWooConfig || {};
  var CUSTOM_PRODUCT_PATHS = cfg.customPaths || '';

  if (window._gtmWooEcommerceDone) return;
  window._gtmWooEcommerceDone = true;

  window.dataLayer = window.dataLayer || [];

  var customPaths = (CUSTOM_PRODUCT_PATHS || '')
    .split(',')
    .map(function (p) { return p.replace(/\s+/g, '').toLowerCase(); })
    .filter(function (p) { return p.length > 0; });

  var path = (window.location.pathname || '').toLowerCase();

  var matchedCustomPath = '';
  for (var ci = 0; ci < customPaths.length; ci++) {
    if (path.indexOf(customPaths[ci]) !== -1) {
      matchedCustomPath = customPaths[ci];
      break;
    }
  }
  var isCustomProduct = matchedCustomPath !== '';

  var body = document.body;
  var classList = (body && body.className) || '';

  var isSingleProduct = /\bsingle-product\b/.test(classList) || isCustomProduct;
  var isListPage = /\bwoocommerce\b/.test(classList) && !isSingleProduct;

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
    var match = classList.match(/term-(\d+)/);
    if (match && match[1]) return match[1];

    return '';
  }

  function getProductCardId(product, fallbackIndex, name) {
    var id = '';

    var atcB = product.querySelector('[data-product_id], .add_to_cart_button');

    if (atcB && atcB.dataset && atcB.dataset.product_id) {
      id = atcB.dataset.product_id;
    }

    if (!id) {
      var clsMatch = product.className.match(/post-(\d+)/);
      if (clsMatch && clsMatch[1]) id = clsMatch[1];
    }

    if (!id && product.id && product.id.indexOf('product-') === 0) {
      id = product.id.replace('product-', '');
    }

    if (!id) {
      id = 'item_' + fallbackIndex + '_' +
        name.toLowerCase().replace(/\W+/g, '-').substring(0, 30);
    }

    return id;
  }

  function getProductCardName(product) {
    var nameEl = product.querySelector(
      '.woocommerce-loop-product__title, h2, h3, .product-title, a[title], .title'
    );

    if (!nameEl) return '';

    var name = cleanText(nameEl.innerText || nameEl.textContent);

    if (!name && nameEl.getAttribute) {
      name = cleanText(nameEl.getAttribute('title') || '');
    }

    return name;
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

  function pushViewItemList() {
    var listName = getListName();
    var listId = getListId();

    var grid = document.querySelector(
      '.products, ul.products, .woocommerce-loop-products, .product-grid, ' +
      '.grid.products, .woocommerce-products, .elementor-products-grid, ' +
      '.ast-woo-shop-products, [class*="product"]'
    );

    if (!grid) return false;

    var products = grid.querySelectorAll(
      'li.product, .product, .woocommerce-loop-product, .product-item, .post, ' +
      '[class*="product"], .elementor-product'
    );

    if (!products.length) return false;

    var items = [];
    var seenIds = {};
    var seenNames = {};

    for (var i = 0; i < products.length; i++) {
      var product = products[i];

      if (!product.querySelector) continue;

      var name = getProductCardName(product);
      if (!name || seenNames[name]) continue;

      var id = getProductCardId(product, i + 1, name);
      if (seenIds[id]) continue;

      var price = getBestPriceFromContainer(product);

      seenNames[name] = true;
      seenIds[id] = true;

      items.push({
        item_id: id,
        item_name: name,
        item_category: getProductCardCategory(product),
        price: price,
        imageUrl: getProductCardImage(product),
        item_list_id: listId,
        item_list_name: listName,
        index: items.length + 1,
        quantity: 1
      });
    }

    if (!items.length) return false;

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
      var listObs = new MutationObserver(function (mutations, ob) {
        if (pushViewItemList()) ob.disconnect();
      });

      listObs.observe(body, { childList: true, subtree: true });

      setTimeout(function () {
        listObs.disconnect();
      }, 10000);
    }
  }
})();
