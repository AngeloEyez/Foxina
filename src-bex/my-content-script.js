// Hooks added here have a bridge allowing communication between the BEX Content Script and the Quasar Application.
// More info: https://quasar.dev/quasar-cli/developing-browser-extensions/content-hooks

import { bexContent } from 'quasar/wrappers';
import { defaultOptions, getOptions } from './foxinaOptions.js';
import { version } from '../package.json';

let domInjected = false;

export default bexContent(bridge => {
    // Hook into the bridge to listen for events sent from the client BEX.
    /*
bridge.on('some.event', event => {
  if (event.data.yourProp) {
    // Access a DOM element from here.
    // Document in this instance is the underlying website the contentScript runs on
    const el = document.getElementById('some-id')
    if (el) {
      el.value = 'Quasar Rocks!'
    }
  }
})
*/

    // Close whatsNew iFrame
    bridge.on('whatsnew.close', async ({ data, respond }) => {
        let opt = await getOptions();

        if (data.doNoShowAgain) {
            opt.sys.showWhatsNew = 0;
        } else {
            opt.sys.showWhatsNew--;
        }
        chrome.storage.local.set({ foxinaOpt: JSON.stringify(opt) }, () => {
            //console.log(`option saved. showWhatsNew:${opt.sys.showWhatsNew}`);
        });

        iFrame.remove();
        respond();
    });

    // 避免 dom.js 注入兩次
    bridge.on('mycontentscript.domInjectd', ({ data, respond }) => {
        if (!domInjected) {
            domInjected = true;
            respond(false);
        } else {
            respond(true);
        }
    });
});

// Inject whatsNew iFrame
//
const iFrame = document.createElement('iframe');
(async function () {
    let opt = await getOptions();

    if (version > opt.sys.version) {
        // 目前為新版本，重設 showWhatsNew次數
        // 若是此版本不須顯示whatsnew, 註解掉此行即可
        //opt.sys.showWhatsNew = defaultOptions.sys.showWhatsNew;

        opt.sys.version = version;
        chrome.storage.local.set({ foxinaOpt: JSON.stringify(opt) }, () => {
            //console.log(`option saved. showWhatsNew:${opt.sys.showWhatsNew}`);
        });
    }
    showWhatsNew(opt.sys.showWhatsNew);

    function showWhatsNew(showWhatsNew) {
        if (showWhatsNew <= 0) return;

        iFrame.id = 'bex-app-iframe';

        Object.assign(iFrame.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            border: '0',
            zIndex: '9999999', // Make sure it's on top
            background: 'transparent'
        });

        (function () {
            // When the page loads, insert our browser extension app.
            iFrame.src = chrome.runtime.getURL('www/index.html#/whatsnew');
            document.body.prepend(iFrame);
        })();
    }
})();
