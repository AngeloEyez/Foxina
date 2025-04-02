// Hooks added here have a bridge allowing communication between the Web Page and the BEX Content Script.
// More info: https://quasar.dev/quasar-cli/developing-browser-extensions/dom-hooks
import { bexDom } from 'quasar/wrappers';
import eLearningHook from './dom/eLearningHook.js';
import generalRequestHook from './dom/generalRequestHook.js';

export default bexDom(bridge => {
    /*
  bridge.send('message.to.quasar', {
    worked: true
  })
  */
    let currentUrl = window.location.href;
    // eLearningHook.js
    // eLearning網站會注入 dom.js 兩次，這段避免 eLearningHook 被注入2次。
    bridge.send('eLearning.domInjectd', { url: currentUrl }).then(event => {
        if (currentUrl.includes('elearning.efoxconn.com') && !event.data) {
            eLearningHook(bridge);
        }
    });
    bridge.send('mycontentscript.domInjectd', { url: currentUrl }).then(event => {
        if (!event.data) {
            //generalRequestHook(bridge);
        }
    });
});
