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

// Monitor opt Change
let opt = {};
chrome.storage.onChanged.addListener(function (changes, namespace) {
    if ('foxinaOpt' in changes) {
        var storageChange = changes['foxinaOpt'];
        opt = JSON.parse(storageChange.newValue);
        //console.log('New value for foxinaOpt:', opt);
    }
});

// 取得考試標題
let exam_title = $('div.exam_title h2').text();
//console.log('[ieduGetAns] 取得課程名稱: ' + exam_title);

// 取得 CourseId
(async () => {
    let courseId = await chrome.runtime.sendMessage({ action: 'getCourseID' });
    if (courseId == 0) {
        console.log("Can't get courseID...");
    } else {
        console.log('CourseID: ' + courseId);
        const response = await chrome.runtime.sendMessage({
            action: 'putCourse',
            doc: {
                _id: exam_title,
                site: 'iedu',
                courseId: courseId
            }
        });

        //console.log(response);
    }
})();

(async () => {
    // 讀取設定
    let storageItems = await chrome.storage.local.get('foxinaOpt');
    opt = JSON.parse(storageItems.foxinaOpt);
    if (!opt.iedu.fillAns) {
        //console.log('iedu fillAns disabled. ', opt.iedu.fillAns);
        return;
    }

    const COURSE = await chrome.runtime.sendMessage({ action: 'getCourse', title: exam_title });

    if (COURSE.status == 404) {
        console.log(`未找到題庫: ${exam_title}`);
    } else {
        console.log(`找到題庫: ${COURSE._id} (${!COURSE.Q ? 0 : Object.keys(COURSE.Q).length}) `);

        // 讀取題目並填入答案
        $('div.question_warp').each(function (id, val) {
            let qTitle = $(this).find('h3').text();
            qTitle = qTitle.substring(qTitle.indexOf('. ', 0) + 2);

            // 題庫有這題
            try {
                if (COURSE.Q[qTitle]) {
                    let answers = COURSE.Q[qTitle];
                    //console.log(answers);

                    // 是非題
                    if (answers.length == 1) {
                        if (answers[0] == '正确') {
                            //$(this).find('input[value=1]')[0].checked = true;
                            //$('#a' + (id + 1)).addClass('active');
                            setTimeout(() => $(this).find('input[value=1]')[0].click(), 100);
                        } else if (answers[0] == '错误') {
                            //$(this).find('input[value=0]')[0].checked = true;
                            //$('#a' + (id + 1)).addClass('active');
                            setTimeout(() => $(this).find('input[value=0]')[0].click(), 100);
                        }
                        //console.log("答題 " + (id+1) +": " + answers[0]);
                    }

                    // 選擇題
                    $(this)
                        .find('input')
                        .each(function (i, v) {
                            let opt = $(this).parent()[0].innerText;
                            opt = opt.substring(opt.indexOf('： ', 0) + 2);
                            if (answers.includes(opt)) {
                                //$(this).attr('checked', true);
                                //$('#a' + (id + 1)).addClass('active');
                                setTimeout(() => $(this).parent()[0].click(), 100);
                                //console.log('答題 ' + (id + 1) + ': 勾選 ' + opt);
                            }
                        });
                }
            } catch {}
        });
    }
})();
