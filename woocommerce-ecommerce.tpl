___INFO___

{
  "type": "TAG",
  "id": "cvt_100000001_1",
  "version": 1,
  "securityGroups": [],
  "displayName": "WooCommerce catalogue views",
  "brand": {"id": "brand_dummy", "displayName": "Custom"},
  "description": "Load the versioned WooCommerce reader from GitHub via jsDelivr. Push product and list views, including view_item_list for configured catalogue paths.",
  "categories": ["ANALYTICS"],
  "containerContexts": ["WEB"]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "SELECT",
    "name": "scopeMode",
    "displayName": "Pages to track",
    "simpleValueType": true,
    "defaultValue": "all",
    "selectItems": [
      {"value": "all", "displayValue": "WooCommerce pages and configured catalogue paths"},
      {"value": "customOnly", "displayValue": "Configured catalogue paths only"}
    ],
    "help": "Choose configured paths only when an existing integration already produces your standard WooCommerce views."
  },
  {
    "type": "TEXT",
    "name": "customListPaths",
    "displayName": "Force view_item_list on these paths",
    "simpleValueType": true,
    "help": "Optional. Select the GTM Constant containing your catalogue paths, or enter comma-separated exact paths. Examples include /vhodni-vrati-unison-doors/ and /print-stakla/. Query strings and trailing slashes are ignored."
  },
  {
    "type": "TEXT",
    "name": "customPaths",
    "displayName": "Custom product detail paths (view_item)",
    "simpleValueType": true,
    "help": "Optional. Keeps the original hosted template's custom product paths and substring matching. Put catalogue paths in the list field above. Product paths take priority if the same page matches both."
  },
  {
    "type": "GROUP",
    "name": "settings",
    "displayName": "Product and catalogue settings",
    "groupStyle": "ZIPPY_CLOSED",
    "subParams": [
      {
        "type": "SELECT",
        "name": "variationMode",
        "displayName": "Variable products",
        "simpleValueType": true,
        "defaultValue": "once",
        "selectItems": [
          {"value": "once", "displayValue": "One view, prefer the selected variation (Expert)"},
          {"value": "changes", "displayValue": "Also track changed variations (Doormann and Unison)"},
          {"value": "parent", "displayValue": "One parent product view (Express)"}
        ],
        "help": "The first two modes use the selected or marked default variation when available. An unresolved form gets an initial parent view."
      },
      {
        "type": "TEXT",
        "name": "fallbackCurrency",
        "displayName": "Fallback store currency",
        "simpleValueType": true,
        "defaultValue": "EUR",
        "help": "ISO 4217 code used when the store supplies no currency. Use the currency in which this shop displays its primary prices."
      },
      {
        "type": "TEXT",
        "name": "catalogSelector",
        "displayName": "Custom catalogue item selector",
        "simpleValueType": true,
        "help": "Optional CSS selector for the configured paths. Match one card, link, image or heading per catalogue entry. Leave blank for the supplied layouts and standard WooCommerce cards."
      },
      {
        "type": "TEXT",
        "name": "productLinkPaths",
        "displayName": "Additional product permalink bases",
        "simpleValueType": true,
        "help": "Optional. Comma-separated bases such as /model/ for themes that link to products using a custom permalink."
      },
      {
        "type": "TEXT",
        "name": "scriptUrl",
        "displayName": "Ecommerce Events Script URL",
        "simpleValueType": true,
        "defaultValue": "https://cdn.jsdelivr.net/gh/dbweb13/gtm-ecommerce-scripts@v1.3.1-preview.1/woocommerce-reader.js",
        "help": "Defaults to the v1.3.1-preview.1 reader in dbweb13/gtm-ecommerce-scripts. When upgrading a tag with an old saved woo-ecommerce.js URL, clear it to use this version. For your own script host, allow the corresponding reader URL under Injects scripts."
      }
    ]
  }
]


___SANDBOXED_JS_FOR_WEB_TEMPLATE___

const callInWindow = require('callInWindow');
const setInWindow = require('setInWindow');
const injectScript = require('injectScript');
const queryPermission = require('queryPermission');
const url = data.scriptUrl || 'https://cdn.jsdelivr.net/gh/dbweb13/gtm-ecommerce-scripts@v1.3.1-preview.1/woocommerce-reader.js';
const options = {
  startFromTemplate: true,
  scopeMode: data.scopeMode || 'all',
  customPaths: data.customPaths || '',
  customListPaths: data.customListPaths || '',
  productLinkPaths: data.productLinkPaths || '',
  catalogSelector: data.catalogSelector || '',
  variationMode: data.variationMode || 'once',
  fallbackCurrency: data.fallbackCurrency || 'EUR'
};
if (!queryPermission('inject_script', url) || !setInWindow('_gtmWooConfig', options, true)) {
  data.gtmOnFailure();
  return;
}
injectScript(url, function() {
  if (callInWindow('wooCatalogViewsHostedV1', options) === true) data.gtmOnSuccess();
  else data.gtmOnFailure();
}, data.gtmOnFailure, url);


___WEB_PERMISSIONS___

[
  {
    "instance": {
      "key": {"publicId": "access_globals", "versionId": "1"},
      "param": [{
        "key": "keys",
        "value": {
          "type": 2,
          "listItem": [
            {
              "type": 3,
              "mapKey": [
                {"type": 1, "string": "key"}, {"type": 1, "string": "read"},
                {"type": 1, "string": "write"}, {"type": 1, "string": "execute"}
              ],
              "mapValue": [
                {"type": 1, "string": "wooCatalogViewsHostedV1"}, {"type": 8, "boolean": false},
                {"type": 8, "boolean": false}, {"type": 8, "boolean": true}
              ]
            },
            {
              "type": 3,
              "mapKey": [
                {"type": 1, "string": "key"}, {"type": 1, "string": "read"},
                {"type": 1, "string": "write"}, {"type": 1, "string": "execute"}
              ],
              "mapValue": [
                {"type": 1, "string": "_gtmWooConfig"}, {"type": 8, "boolean": true},
                {"type": 8, "boolean": true}, {"type": 8, "boolean": false}
              ]
            }
          ]
        }
      }]
    },
    "clientAnnotations": {"isEditedByUser": true},
    "isRequired": true
  },
  {
    "instance": {
      "key": {"publicId": "inject_script", "versionId": "1"},
      "param": [{
        "key": "urls",
        "value": {
          "type": 2,
          "listItem": [{"type": 1, "string": "https://cdn.jsdelivr.net/gh/dbweb13/gtm-ecommerce-scripts@*/woocommerce-reader.js"}]
        }
      }]
    },
    "clientAnnotations": {"isEditedByUser": true},
    "isRequired": true
  }
]


___TESTS___

scenarios:
- name: The default hosted reader receives separate product and catalogue paths
  code: |-
    mock('queryPermission', true);
    mock('setInWindow', true);
    mock('injectScript', function(url, loaded, failed, cacheKey) {
      assertThat(url).isEqualTo('https://cdn.jsdelivr.net/gh/dbweb13/gtm-ecommerce-scripts@v1.3.1-preview.1/woocommerce-reader.js');
      assertThat(cacheKey).isEqualTo(url);
      loaded();
    });
    mock('callInWindow', function(key, options) {
      assertThat(key).isEqualTo('wooCatalogViewsHostedV1');
      assertThat(options.customListPaths).isEqualTo('/catalogue');
      assertThat(options.customPaths).isEqualTo('/custom-door');
      return true;
    });
    runCode({customPaths: '/custom-door', customListPaths: '/catalogue'});
    assertApi('gtmOnSuccess').wasCalled();
- name: A denied URL never loads a script
  code: |-
    mock('queryPermission', false);
    runCode({});
    assertApi('gtmOnFailure').wasCalled();
    assertApi('injectScript').wasNotCalled();
- name: A failed script load reports failure
  code: |-
    mock('queryPermission', true);
    mock('setInWindow', true);
    mock('injectScript', function(url, loaded, failed) { failed(); });
    runCode({});
    assertApi('gtmOnFailure').wasCalled();


___NOTES___

Import this tag template in a GTM web container. Attach the existing DOM Ready
trigger or All Pages. The reader waits for DOMContentLoaded on an early trigger.
Configure list and product paths separately and use Preview to inspect the
resulting events. The default jsDelivr URL is pinned to the GitHub release tag.
