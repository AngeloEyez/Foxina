// Hooks added here have a bridge allowing communication between the BEX Content Script and the Quasar Application.
// More info: https://quasar.dev/quasar-cli/developing-browser-extensions/content-hooks

import { bexContent } from 'quasar/wrappers';

export default bexContent((/* bridge */) => {
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
});
var $ = require('./modules/jquery-3.6.3.min.js');

// 取得考試標題
var exam_title = $('div.exam_title h2').text();
//console.log('[ieduGetAns] 取得課程標題: ' + exam_title);

let Q = {};
// 讀取 題目/答案
$('div.question_warp').each(function (index, val) {
    let qTitle = $(this).find('h3').text();
    qTitle = qTitle.substring(qTitle.indexOf('. ', 0) + 2);
    //console.log(index + ": " + qTitle );

    let ans = $(this).find('p.answer > strong:first').text();
    //console.log("ans:" + ans);

    let answers = [];
    // 判斷題型
    if (ans == '错误' || ans == '正确') {
        answers.push(ans);
        //console.log("是非題 " + answers);
    } else {
        ans.split('').forEach(
            function (v) {
                let opt = $(this)
                    .find('input[value=' + v + ']')
                    .parent()[0].innerText;
                opt = opt.substring(opt.indexOf('： ', 0) + 2);
                answers.push(opt);
                //console.log($(this).find('input[value='+v+']').parent()[0].innerText );
            }.bind(this)
        );
        //console.log("選擇題: " + answers);
    }
    Q[qTitle] = answers;
});
//console.log(Q);

(async () => {
    const response = await chrome.runtime.sendMessage({
        action: 'putCourse',
        doc: {
            _id: exam_title,
            site: 'iedu',
            Q: Q
        }
    });

    //console.log(response);
})();

// // 儲存到 local storage
// chrome.storage.local.get([exam_title]).then((E) => {
//   console.log(E);
//   if (E.length != 0) {
//     Object.entries(Q).forEach((obj) => {
//       console.log(obj[0] + " | " + obj[1]);
//       E[exam_title][obj[0]] = obj[1];
//     });

//     chrome.storage.local.set(E).then(() => {
//       console.log(exam_title + "答案已更新");
//     });
//   } else {
//       let EXAM = {};
//       EXAM[exam_title] = Q;
//       chrome.storage.local.set(EXAM).then(() => {
//         console.log(exam_title + "答案已儲存");
//       });
//   }
// });
