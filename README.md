# WooCommerce ecommerce events for Google Tag Manager

Import **woocommerce-ecommerce.tpl** into a GTM web container using **Templates → Tag Templates → New → ⋮ → Import**. Create a tag from the template and use your existing DOM Ready trigger or the built-in All Pages trigger. The tag loads the reader from the versioned URL in its settings. [Download the v1.3.0 template](https://cdn.jsdelivr.net/gh/dbweb13/gtm-ecommerce-scripts@v1.3.0/woocommerce-ecommerce.tpl)

- **Force view_item_list on these paths** accepts comma-separated exact catalogue paths or a GTM Constant. Examples are `/vhodni-vrati-unison-doors/` and `/print-stakla/`. These pages report their door series and print themes as named catalogue entries.
- **Custom product detail paths (view_item)** retains the earlier `customPaths` setting. Product overrides take priority when a path appears in both fields. When converting a catalogue from the old product override, move its path into the list field.
- **Pages to track** can cover normal WooCommerce products and archives or only your configured lists. Choose lists only when another integration already sends the standard views.
- **Variable products** can report one selected variation, subsequent variation changes, or only the parent product. The template also accepts a fallback store currency, extra product permalink bases and a custom catalogue item selector.

The default **Ecommerce Events Script URL** is pinned to v1.3.0. Clear any previously saved `woo-ecommerce.js` URL when upgrading an existing tag to the unified template. If your DOM Ready trigger filters pages using a Constant, include the catalogue paths in that trigger as well. Check the resulting `view_item` and `view_item_list` pushes in GTM Preview before publishing. [Versioned browser script](https://cdn.jsdelivr.net/gh/dbweb13/gtm-ecommerce-scripts@v1.3.0/woocommerce-reader.js)
