(function (win, doc) {
  'use strict';
  var config = win._gtmWooConfig;
  if (typeof win.wooCatalogViewsHostedV1 === 'function') {
    if (config && !config.startFromTemplate) win.wooCatalogViewsHostedV1(config);
    return;
  }

  var started = false;
  var excluded = 'nav, aside, footer, [role="navigation"], .site-header, .elementor-location-header, ' +
    '.related, .upsells, .cross-sells, .widget_shopping_cart, .wc-block-mini-cart';
  var grids = '.products, .woocommerce-products, .woocommerce-loop-products, .product-grid, ' +
    '.elementor-products-grid, .ast-woo-shop-products, .wc-block-grid__products, .wc-block-product-template';
  var cards = 'li.product, .product, .woocommerce-loop-product, .product-item, .elementor-product, ' +
    '.wc-block-grid__product, .wc-block-product, .wp-block-post, .post';
  var productLinks;
  var titleSelector = '.woocommerce-loop-product__title, .wc-block-grid__product-title, ' +
    '.wp-block-post-title, .product-title, .product_title, .title, h1, h2, h3, h4';
  var curatedCards = '.elementor-widget-html .container > .section, .glassman-kitchen-section #accordion > h3';

  function clean(value) {
    return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
  }

  function attr(node, key) {
    return node ? clean(node.getAttribute(key)) : '';
  }

  function label(node) {
    return node ? clean(node.textContent) : '';
  }

  function parseJson(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function pathKey(value) {
    var path = clean(value).split(/[?#]/)[0];
    if (path.charAt(0) !== '/' || path.indexOf('//') === 0) return '';
    try { path = decodeURI(path); } catch (e) { /* Keep literal paths with malformed escapes. */ }
    return path.replace(/\/+$/, '').toLowerCase() || '/';
  }

  function linkSelector(extraBases) {
    var bases = ['/product/', '/produkt/', '/produs/', '/producto/', '/produto/',
      '/prodotto/', '/produit/', '/proizvod/', '/tovar/'];
    var selectors = ['a.woocommerce-loop-product__link', 'a.woocommerce-LoopProduct-link', 'a.wc-block-grid__product-link'];
    String(extraBases || '').split(',').forEach(function (entry) {
      var base = pathKey(entry);
      if (base && base !== '/' && bases.indexOf(base + '/') === -1) bases.push(base + '/');
    });
    bases.forEach(function (base) {
      selectors.push('a[href*="' + base.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]');
    });
    return selectors.join(', ');
  }

  function inMain(node, selector) {
    var matches = node.querySelectorAll(selector);
    for (var i = 0; i < matches.length; i++) {
      if (!matches[i].closest(excluded)) return matches[i];
    }
    return null;
  }

  function content() {
    return doc.querySelector('main, [role="main"], #primary, #main, #content') || doc.body;
  }

  function pageTitle() {
    var heading = inMain(content(), 'h1') || inMain(doc, 'h1');
    return label(heading) || clean(doc.title.split(/\s+[|–—]\s+/)[0]);
  }

  function code(value) {
    var iso = clean(value).toUpperCase();
    return /^[A-Z]{3}$/.test(iso) ? iso : '';
  }

  function declaredCurrency(root) {
    return code(attr(doc.head.querySelector('meta[property="product:price:currency"]'), 'content')) ||
      code(attr(doc.head.querySelector('[itemprop="priceCurrency"]'), 'content')) ||
      code(win.wcSettings && win.wcSettings.currency && win.wcSettings.currency.code) ||
      code(attr(root && inMain(root, '[itemprop="priceCurrency"][content]'), 'content'));
  }

  function machinePrice(value) {
    var raw = clean(value);
    if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
    var n = Number(raw);
    return isFinite(n) ? n : null;
  }

  function printedCurrency(text, fallback) {
    if (/€|\bEUR\b/i.test(text)) return 'EUR';
    if (/лв|лева|\bBGN\b/i.test(text)) return 'BGN';
    if (/£/.test(text)) return 'GBP';
    var iso = text.match(/\b([A-Z]{3})\b/);
    if (iso && iso[1] !== 'VAT') return iso[1];
    if (/\$/.test(text)) return /^(USD|CAD|AUD|NZD|SGD|HKD|MXN|ARS|CLP|COP|TWD|BRL)$/.test(fallback) ? fallback : '?';
    if (/¥|￥/.test(text)) return /^(JPY|CNY)$/.test(fallback) ? fallback : '?';
    return '';
  }

  function printedPrice(raw, currency) {
    // Read one price at a time on bilingual displays and ranges.
    var parts = clean(raw).split(/\s*(?:\/|[()]|[–—]|\s-\s)\s*/);
    var unknown = null;
    for (var i = 0; i < parts.length; i++) {
      var unit = printedCurrency(parts[i], currency);
      if (unit && unit !== currency) continue;
      var numbers = parts[i].match(/-?\d+(?:[\s.,'’]\d+)*/g);
      if (!numbers || numbers.length !== 1 || numbers[0].charAt(0) === '-') continue;
      var token = numbers[0].replace(/[\s'’]/g, '');
      var decimal = Math.max(token.lastIndexOf('.'), token.lastIndexOf(','));
      if (decimal >= 0) {
        var grouped = /^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/.test(token) &&
          !/^(BHD|IQD|JOD|KWD|LYD|OMR|TND)$/.test(currency);
        token = grouped ? token.replace(/[.,]/g, '') :
          token.slice(0, decimal).replace(/[.,]/g, '') + '.' + token.slice(decimal + 1);
      }
      var amount = machinePrice(token);
      if (amount !== null && unit) return amount;
      if (unknown === null) unknown = amount;
    }
    return unknown;
  }

  function priceIn(root, currency, productPage) {
    if (!root) return null;
    var ignore = excluded + ', del, s, .screen-reader-text';
    if (productPage) ignore += ', ' + grids + ', .the7-swiper-slide';
    var selectors = [
      '[itemprop="price"][content]',
      'ins .amount, .sale-price .amount, ins bdi',
      '.woocommerce-Price-amount, .price .amount, .wc-block-components-product-price__value',
      '.price ins, p.price, span.price, .wc-block-grid__product-price'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var nodes = root.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j];
        if (node.closest(ignore)) continue;
        // A parent containing an old price or nested amounts cannot supply a single current price.
        if (node.querySelector('del, s, .woocommerce-Price-amount')) continue;
        var text = label(node);
        if (node.closest('.price-euro') && !printedCurrency(text, currency)) continue;
        if (node.hasAttribute('content')) {
          var offer = node.closest('[itemtype$="/Offer"], [itemprop="offers"]') || root;
          var unit = code(attr(offer.querySelector('[itemprop="priceCurrency"][content]'), 'content'));
          if (unit && unit !== currency) continue;
        }
        var value = node.hasAttribute('content') ? machinePrice(attr(node, 'content')) : printedPrice(text, currency);
        if (value !== null) return value;
      }
    }
    return null;
  }

  function numericId(value) {
    var id = clean(value);
    return /^[1-9]\d*$/.test(id) ? id : '';
  }

  function wooId(node) {
    if (!node) return '';
    var dataId = numericId(attr(node, 'data-product_id')) || numericId(attr(node, 'data-product-id'));
    if (!dataId && node.hasAttribute('data-wp-context')) {
      var context = parseJson(node.getAttribute('data-wp-context'));
      dataId = numericId(context && context.productId);
    }
    var match = (node.id + ' ' + node.className).match(/(?:^|\s)(?:product-|post-|postid-)(\d+)(?:\s|$)/);
    return dataId || (match ? numericId(match[1]) : '');
  }

  function imageUrl(node) {
    if (!node) return '';
    var src = attr(node, 'data-lazy-src') || attr(node, 'data-src') || attr(node, 'src');
    if (!src || /^data:/i.test(src)) return '';
    try {
      var url = new URL(src, doc.baseURI);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (e) { return ''; }
  }

  function productSchema() {
    var scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    var candidates = [];
    function collect(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(collect); return; }
      var types = [].concat(node['@type'] || []);
      if (types.indexOf('Product') !== -1 || types.indexOf('ProductGroup') !== -1) candidates.push(node);
      if (node['@graph']) collect(node['@graph']);
      if (node.mainEntity) collect(node.mainEntity);
    }
    for (var i = 0; i < scripts.length; i++) collect(parseJson(scripts[i].textContent));
    var current = pathKey(win.location.pathname);
    for (var j = 0; j < candidates.length; j++) {
      var ref = candidates[j].url || candidates[j]['@id'];
      if (typeof ref !== 'string') continue;
      try {
        var url = new URL(ref, doc.baseURI);
        if (url.origin === win.location.origin && pathKey(url.pathname) === current) return candidates[j];
      } catch (e) { /* Other schema nodes may identify the current product. */ }
    }
    return candidates.length === 1 && !candidates[0].url && !candidates[0]['@id'] ? candidates[0] : {};
  }

  function productData(fallbackCurrency, finalAttempt) {
    var main = content();
    var schema = productSchema();
    var title = label(inMain(main, '.product_title')) || clean(schema.name) || label(inMain(main, 'h1'));
    if (!title && finalAttempt) title = pageTitle();
    if (!title) return null;
    var form = inMain(main, 'form.variations_form') || inMain(main, 'form.cart');
    if (!finalAttempt && !form && inMain(main, '.product-type-variable')) return null;
    var summary = inMain(main, '.summary.entry-summary, .summary, .wp-block-woocommerce-single-product') || main;
    var button = form ? form.querySelector('[name="add-to-cart"]') : inMain(main, '[name="add-to-cart"]');
    var id = numericId(button && button.value) || wooId(doc.body) || wooId(form) ||
      numericId(attr(doc.querySelector('meta[itemprop="productID"]'), 'content')) || clean(schema.productID);
    var item = {item_name: title, affiliation: win.location.hostname, quantity: 1};
    var sku = clean(schema.sku) || label(inMain(main, '.product_meta .sku, .sku'));
    if (id || sku) item.item_id = id || sku;
    if (sku) item.item_sku = sku;
    var brand = [].concat(schema.brand || [])[0];
    if (brand) {
      var brandName = clean(typeof brand === 'string' ? brand : brand.name);
      if (brandName) item.item_brand = brandName;
    }
    var photo = [].concat(schema.image || [])[0];
    var src = (typeof photo === 'string' ? photo : photo && (photo.url || photo.contentUrl)) ||
      imageUrl(inMain(main, '.woocommerce-product-gallery img, .wp-block-woocommerce-product-image-gallery img'));
    if (src) item.imageUrl = src;

    var cats = [];
    var crumbs = doc.querySelectorAll('.woocommerce-breadcrumb a');
    Array.prototype.forEach.call(crumbs, function (link) {
      var name = label(link);
      if (name && !/^(?:home|homepage|начало)$/i.test(name) && pathKey(link.pathname) !== '/' &&
          cats.indexOf(name) === -1) cats.push(name);
    });
    if (!cats.length) {
      Array.prototype.forEach.call(main.querySelectorAll('.posted_in a'), function (link) {
        var name = label(link);
        if (name && cats.indexOf(name) === -1) cats.push(name);
      });
    }
    cats.slice(0, 5).forEach(function (name, index) {
      item[index ? 'item_category' + (index + 1) : 'item_category'] = name;
    });

    var metaCurrency = declaredCurrency(summary);
    var currency = metaCurrency || code(fallbackCurrency) || 'EUR';
    var price = null;
    var offers = [].concat(schema.offers || []);
    for (var k = 0; k < offers.length; k++) {
      var offer = offers[k] || {};
      var offerUnit = code(offer.priceCurrency);
      if (metaCurrency && offerUnit && metaCurrency !== offerUnit) continue;
      price = machinePrice(offer.price);
      if (price === null) price = machinePrice(offer.lowPrice);
      if (price !== null) { currency = offerUnit || metaCurrency || currency; break; }
    }
    if (price === null) {
      currency = metaCurrency || currency;
      price = machinePrice(attr(doc.head.querySelector('[property="product:price:amount"]'), 'content'));
      if (price === null) price = priceIn(summary, currency, true);
    }
    if (price !== null) item.price = price;
    return {item: item, currency: currency, form: form};
  }

  function startProduct(base, mode, emit) {
    var form = base.form;
    var lastKey = '';
    var fallback;
    var jq;
    function send(variation) {
      var item = {};
      Object.keys(base.item).forEach(function (key) { item[key] = base.item[key]; });
      var id = variation && numericId(variation.variation_id);
      var key = id ? 'variation/' + id : 'parent';
      if (key === lastKey || (lastKey && mode !== 'changes')) return;
      if (id) {
        item.item_id = id;
        var attrs = variation.attributes || {};
        var values = Object.keys(attrs).map(function (k) {
          var select = form.elements.namedItem(k);
          return clean(attrs[k]) || clean(select && select.value);
        }).filter(Boolean);
        if (values.length) item.item_variant = values.join(' • ');
        var price = machinePrice(variation.display_price);
        if (price === null) price = priceIn(form.querySelector('.woocommerce-variation-price'), base.currency);
        if (price === null) delete item.price;
        else item.price = price;
        if (variation.sku) item.item_sku = clean(variation.sku);
        if (variation.image && variation.image.src) item.imageUrl = variation.image.src;
      }
      lastKey = key;
      win.clearTimeout(fallback);
      if (mode !== 'changes' && jq) jq.off('found_variation.wooCatalogViews', found);
      var ecommerce = {currency: base.currency, items: [item]};
      if (typeof item.price === 'number') ecommerce.value = item.price;
      emit({event: 'view_item', ecomm_pagetype: 'product', ecommerce: ecommerce});
    }
    function found(event, variation) {
      if (variation && numericId(variation.variation_id)) send(variation);
    }
    if (mode === 'parent' || !form || !form.matches('.variations_form')) { send(null); return; }

    var rows = parseJson(form.getAttribute('data-product_variations'));
    var selects = Array.prototype.slice.call(form.querySelectorAll('select[name^="attribute_"]'));
    function selection(fromSelect) {
      var idField = form.querySelector('[name="variation_id"]');
      var id = numericId(idField && idField.value);
      var chosen = selects.length && selects.every(function (select) { return !!select.value; });
      var options = Array.isArray(rows) ? rows : [];
      for (var i = 0; i < options.length; i++) {
        var row = options[i];
        if (!row || !numericId(row.variation_id)) continue;
        if (id && !fromSelect) {
          if (numericId(row.variation_id) === id) return row;
        } else if (chosen) {
          var attrs = row.attributes || {};
          if (selects.every(function (select) {
            return Object.prototype.hasOwnProperty.call(attrs, select.name) &&
              (!attrs[select.name] || attrs[select.name] === select.value);
          })) return row;
        } else if (!fromSelect && row.is_default === true) {
          return row;
        }
      }
      if (!id || fromSelect) return null;
      var values = {};
      selects.forEach(function (select) { values[select.name] = select.value; });
      return {variation_id: id, attributes: values};
    }

    if (typeof win.jQuery === 'function') {
      jq = win.jQuery(form);
      jq.on('found_variation.wooCatalogViews', found);
    } else if (mode === 'changes') {
      form.addEventListener('change', function (event) {
        if (event.target.matches('select[name^="attribute_"], [name="variation_id"]')) {
          var choice = selection(event.target.tagName === 'SELECT');
          if (choice) send(choice);
        }
      });
    }
    var initial = selection(false);
    // An AJAX form can expose an ID before Woo supplies its SKU and price.
    if (jq && (!initial || machinePrice(initial.display_price) === null)) {
      fallback = win.setTimeout(function () { send(selection(false)); }, 700);
    } else send(initial);
  }

  function productCards(root) {
    var result = [];
    var containers = root.querySelectorAll(grids);
    for (var i = 0; i < containers.length; i++) {
      var nodes = containers[i].querySelectorAll(cards);
      for (var j = 0; j < nodes.length; j++) {
        var card = nodes[j];
        var parentCard = card.parentElement.closest(cards);
        var nested = parentCard && parentCard !== containers[i] && containers[i].contains(parentCard);
        if (card.closest(grids) === containers[i] && !card.closest(excluded) && !nested) {
          result.push(card);
        }
      }
    }
    return result;
  }

  function linkedCards(root) {
    var links = root.querySelectorAll(productLinks + ', [data-product_id], .add_to_cart_button');
    var nodes = [];
    Array.prototype.forEach.call(links, function (link) {
      if (link.closest(excluded)) return;
      var card = link.closest('article, li, .product-item, .section, .product');
      if (!card) {
        // A linked image and its heading may live in sibling builder widgets.
        var parent = link;
        while (parent && parent !== root && !parent.matches(grids)) {
          if (parent.matches(titleSelector) || parent.querySelector(titleSelector)) {
            var siblings = parent.querySelectorAll(productLinks);
            if (Array.prototype.every.call(siblings, function (other) {
              return other.href === siblings[0].href;
            })) card = parent;
            break;
          }
          parent = parent.parentElement;
        }
      }
      if (card && !card.matches('.product-category') && nodes.indexOf(card) === -1) nodes.push(card);
    });
    return nodes;
  }

  function diviCards(root) {
    var buttons = root.querySelectorAll('.entry-content .et_pb_column a.et_pb_button[href]');
    var result = [];
    Array.prototype.forEach.call(buttons, function (button) {
      var column = button.closest('.et_pb_column');
      var heading = column.querySelector('.et_pb_text.et_clickable h2, .et_pb_text.et_clickable h3');
      if (heading && column.querySelector('img') && !column.closest(excluded) && result.indexOf(column) === -1) {
        result.push(column);
      }
    });
    return result;
  }

  function galleryModels(root) {
    var entries = [];
    var swatches = Object.create(null);
    var images = root.querySelectorAll('.entry-content figure.wp-block-image img');
    Array.prototype.forEach.call(images, function (img) {
      if (img.closest(excluded)) return;
      var src = imageUrl(img);
      if (!src) return;
      // A01.png and G01-1.png are model swatches. WordPress can add a size suffix.
      var filename = new URL(src).pathname.split('/').pop();
      var match = /^(?:(.+)[_-])?([a-z]\d{2,5})(?:-\d+)?(?:-\d+x\d+)?\.(?:avif|jpe?g|png|webp)$/i.exec(filename);
      if (!match) return;
      var model = match[2].toUpperCase();
      var photo = !!match[1];
      // A kitchen photo can be the sole image of a model. Its alt must confirm the code.
      if (photo && attr(img, 'alt').toUpperCase().split(/[^A-Z0-9]+/).indexOf(model) === -1) return;
      if (!photo) swatches[model] = true;
      entries.push({key: 'model/' + model, photo: photo, item: {item_name: model, imageUrl: src, quantity: 1}});
    });
    return entries.filter(function (entry) { return !entry.photo || !swatches[entry.item.item_name]; });
  }

  function listEntry(node, custom, currency) {
    var heading = node.matches(titleSelector) ? node : node.querySelector(titleSelector);
    var link = node.matches('a[href]') ? node : node.querySelector(productLinks) ||
      node.querySelector('a[href]:not(.add_to_cart_button)');
    var img = node.matches('img') ? node : node.querySelector('img');
    var name = label(heading) || attr(link, 'title') || attr(node, 'aria-label') || attr(img, 'alt');
    if (!name && link && link.matches(productLinks)) name = label(link);
    if (!name && custom) name = label(node);
    var categoryTile = node.matches('.product-category');
    if (categoryTile) name = name.replace(/\s*\(\s*\d+\s*\)\s*$/, '');
    var button = node.querySelector('[data-product_id], [data-product-id], a[href*="add-to-cart="]');
    var markedProduct = node.matches('.product, .type-product, [data-product_id], [data-product-id]');
    var id = ((!custom || markedProduct) && !categoryTile && wooId(node)) || wooId(button) || attr(node, 'data-item-id');
    if (!id && button && button.href && /^https?:$/.test(button.protocol)) {
      id = numericId(new URL(button.href).searchParams.get('add-to-cart'));
    }
    var href = '';
    if (link && /^https?:$/.test(link.protocol)) {
      var target = new URL(link.href);
      var plainId = numericId(target.searchParams.get('p'));
      if (!id && plainId && !categoryTile && (!custom || target.searchParams.get('post_type') === 'product')) {
        id = plainId;
      }
      href = target.origin + target.pathname.replace(/\/$/, '');
      if (target.searchParams.has('product')) href += '?product=' + target.searchParams.get('product');
      else if (plainId) href += '?p=' + plainId;
    }
    if (!id && !name) return null;
    var item = {quantity: 1};
    if (id) item.item_id = id;
    if (name) item.item_name = name;
    var cat = label(node.querySelector('.posted_in, .product_cat, .product-category, .ast-woo-product-category'));
    if (cat) item.item_category = cat;
    var price = categoryTile ? null : priceIn(node, currency);
    if (price !== null) item.price = price;
    var image = imageUrl(img);
    if (image) item.imageUrl = image;
    return {item: item, key: id ? 'id/' + id : href || (custom && node.id) || 'name/' + name};
  }

  function sendList(options, forced, emit) {
    var main = content();
    var selector = forced && clean(options.catalogSelector);
    var nodes = selector ? doc.querySelectorAll(selector) : [];
    var custom = !!selector;
    if (!selector) {
      if (forced) nodes = doc.querySelectorAll(curatedCards);
      custom = !!nodes.length;
      if (!nodes.length) nodes = productCards(main);
      if (!nodes.length) nodes = linkedCards(main);
      if (forced && !nodes.length) {
        nodes = diviCards(main);
        custom = !!nodes.length;
      }
    }
    var entries = forced && !selector && !nodes.length ? galleryModels(main) : [];
    if (!nodes.length && !entries.length) return false;
    var items = [];
    var seen = Object.create(null);
    var currency = declaredCurrency(nodes[0]) || code(options.fallbackCurrency) || 'EUR';
    var listName = pageTitle() || win.location.pathname;
    var term = doc.body.className.match(/(?:^|\s)term-(\d+)(?:\s|$)/);
    var listId = term ? term[1] : pathKey(win.location.pathname);
    Array.prototype.forEach.call(nodes, function (node) {
      if (!node.closest(excluded)) entries.push(listEntry(node, custom, currency));
    });
    entries.forEach(function (entry) {
      if (!entry || seen[entry.key]) return;
      seen[entry.key] = true;
      entry.item.index = items.length + 1;
      entry.item.item_list_name = listName;
      entry.item.item_list_id = listId;
      items.push(entry.item);
    });
    for (var i = 0; i < items.length; i += 200) {
      emit({event: 'view_item_list', ecomm_pagetype: 'category', ecommerce: {
        item_list_id: listId, item_list_name: listName, currency: currency, items: items.slice(i, i + 200)
      }});
    }
    return items.length > 0;
  }

  function whenRendered(read) {
    if (read(false)) return;
    var retry;
    var deadline;
    var observer;
    function stop() {
      if (observer) observer.disconnect();
      win.clearTimeout(retry);
      win.clearTimeout(deadline);
    }
    function attempt() {
      retry = null;
      if (read(false)) stop();
    }
    if (win.MutationObserver) {
      observer = new win.MutationObserver(function () {
        if (!retry) retry = win.setTimeout(attempt, 60);
      });
      observer.observe(doc.body, {childList: true, subtree: true, attributes: true, characterData: true});
    }
    deadline = win.setTimeout(function () { stop(); read(true); }, 10000);
  }

  function start(options, emit) {
    if (started) return true;
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', function ready() {
        doc.removeEventListener('DOMContentLoaded', ready);
        start(options, emit);
      });
      return true;
    }
    if (!doc.body) return false;
    var classes = doc.body.classList;
    if (['woocommerce-cart', 'woocommerce-checkout', 'woocommerce-account', 'woocommerce-order-received']
        .some(function (c) { return classes.contains(c); })) return true;
    var path = pathKey(win.location.pathname);
    // Older hosted tags use substring matching for custom product paths.
    var customProduct = String(options.customProductPaths || '').split(',').map(pathKey).filter(function (entry) {
      return entry && (entry === '/' ? path === '/' : path.indexOf(entry) !== -1);
    })[0];
    var forced = !customProduct && String(options.customPaths || '').split(/[,\n]/).some(function (entry) {
      return pathKey(entry) === path;
    });
    if (!forced && options.scopeMode === 'customOnly') return true;
    var single = !!customProduct || classes.contains('single-product') ||
      (attr(doc.head.querySelector('[property="og:type"]'), 'content') === 'product' &&
        !!inMain(content(), 'h1.product_title, form.cart, .wp-block-woocommerce-product-price'));
    var archive = /(?:^|\s)(?:woocommerce-shop|post-type-archive-product|tax-product_cat|tax-product_tag|tax-product_brand|tax-pa_[^\s]+)(?:\s|$)/.test(doc.body.className) ||
      ((classes.contains('archive') || classes.contains('search')) && classes.contains('woocommerce')) ||
      ((classes.contains('archive') || classes.contains('search') || classes.contains('woocommerce')) &&
        !!inMain(content(), grids));
    if (!forced && !single && !archive) return true;
    if (forced && clean(options.catalogSelector)) {
      try { doc.querySelector(options.catalogSelector); } catch (e) { return false; }
    }
    productLinks = linkSelector(options.productLinkPaths);
    started = true;
    whenRendered(function (finalAttempt) {
      if (forced || !single) return sendList(options, forced, emit);
      var base = productData(options.fallbackCurrency, finalAttempt || !!customProduct);
      if (!base) return false;
      if (customProduct) {
        var slug = customProduct.replace(/^\/|\/$/g, '').replace(/\//g, '-');
        if (slug) {
          base.item.item_id = slug;
          if (!base.item.item_category) base.item.item_category = slug.replace(/-/g, ' ');
        }
      }
      startProduct(base, customProduct ? 'parent' : options.variationMode, emit);
      return true;
    });
    return true;
  }

  // The callback entry also serves containers installed from the earlier local bundle.
  win.wooCatalogViewsV1 = start;
  function startHosted(settings) {
    return start({
      customPaths: settings.customListPaths,
      customProductPaths: settings.customPaths,
      productLinkPaths: settings.productLinkPaths,
      scopeMode: settings.scopeMode || 'all',
      variationMode: settings.variationMode || 'changes',
      fallbackCurrency: settings.fallbackCurrency || 'EUR',
      catalogSelector: settings.catalogSelector
    }, function (message) {
      var queue = win.dataLayer || (win.dataLayer = []);
      queue.push({ecommerce: null});
      queue.push(message);
    });
  }
  win.wooCatalogViewsHostedV1 = startHosted;
  // Original templates set the global configuration and only inject the file.
  // Updated templates call startHosted with their own tag's options after loading.
  if (config && !config.startFromTemplate) startHosted(config);
})(window, document);
