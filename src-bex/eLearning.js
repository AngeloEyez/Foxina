// Hooks added here have a bridge allowing communication between the BEX Content Script and the Quasar Application.
// More info: https://quasar.dev/quasar-cli/developing-browser-extensions/content-hooks

import { bexContent } from 'quasar/wrappers';
import { getOptions } from './foxinaOptions.js';

let domInjected = false;

export default bexContent(bridge => {
    // Hook into the bridge to listen for events sent from the client BEX.
    /*
    bridge.on('some.event', event => {
        if (event.data.yourProp) {
            // Access a DOM element from here.
            // Document in this instance is the underlying website the contentScript runs on
            const el = document.getElementById('some-id');
            if (el) {
                el.value = 'Quasar Rocks!';
            }
        }
    });
    */

    bridge.on('eLearning.exam', ({ data, respond }) => {
        if (data.type && data.type == 'FROM_PAGE') {
            fillAns(data.exam.question);
        }
        respond();
    });

    // 避免 eLearningHook 注入兩次
    bridge.on('eLearning.domInjectd', ({ data, respond }) => {
        if (!domInjected) {
            domInjected = true;
            respond(false);
        } else {
            respond(true);
        }
    });
});

var $ = require('./modules/jquery-3.6.3.min.js');
var opt = {};

// Monitor opt Change
chrome.storage.onChanged.addListener(function (changes, namespace) {
    if ('foxinaOpt' in changes) {
        var storageChange = changes['foxinaOpt'];
        opt = JSON.parse(storageChange.newValue);
        //console.log('New value for foxinaOpt:', opt);
    }
});
(async () => {
    opt = await getOptions();
})();

// URL change event
// chrome.runtime.onMessage.addListener(function (request) {
//     if (request && request.type === 'eLearning.exam') {
//         console.log(location.pathname);
//         //injectScript('eLearning-inj.js');
//     }
// });

// Fill answers

function fillAns(question) {
    if (!opt.elearning.fillAns) {
        return;
    }

    //console.log(question);
    var questionItems = $('div.question-item');
    questionItems.each(function (index, element) {
        var $questionItem = $(element);
        // 获取题目内容
        var questionContent = $questionItem.contents().first().text().trim();

        // 去除开头的编号和句点
        questionContent = questionContent
            .replace(/^\d+\./, '')
            .replace(/^\s*\./, '')
            .trim();
        //console.log(questionContent);

        // 在 questionArray 中搜索对应的题目
        var foundQuestion = question.find(function (q) {
            return q.question.trim() === questionContent;
            // Fix:q.question去掉頭尾空白，避免原考題帶有空白而比對不出來
        });

        if (foundQuestion) {
            //console.log(`Correct Answer: ${foundQuestion.correctAnswer}`);

            // 区分单选题和多选题
            if (foundQuestion.questionType === 1) {
                // 在选项中查找匹配的答案并添加 "is-checked" 类
                $questionItem.find('label').each(function () {
                    var $label = $(this);
                    var optionText = $label.find('.el-radio__label').text().trim();
                    optionText = optionText.split('.')[0].trim(); // 仅保留第一个 "." 之前的内容

                    // 判断选项是否是正确答案
                    if (optionText === foundQuestion.correctAnswer.trim()) {
                        //$label.addClass('is-checked');
                        //$label.find('.el-radio__input').addClass('is-checked');
                        setTimeout(() => $label[0].click(), 100);
                    }
                });
            } else if (foundQuestion.questionType === 2) {
                var correctAnswers = foundQuestion.correctAnswer.split(',');

                $questionItem.find('label').each(function () {
                    var $label = $(this);
                    var optionText = $label.find('.el-checkbox__label').text().trim();
                    optionText = optionText.split('.')[0].trim();

                    // 判断选项是否是正确答案的一部分
                    if (correctAnswers.includes(optionText)) {
                        //$label.addClass('is-checked');
                        //$label.find('.el-checkbox__input').addClass('is-checked');
                        setTimeout(() => $label[0].click(), 100);
                        $label.css('color', 'red');
                    }
                });
            } else {
                console.log('Question Type: 未知题型');
            }
        } else {
            console.log('No matching question found in the question array');
        }
    });
}

(async () => {
    //const COURSE = await chrome.runtime.sendMessage({ action: 'getCourse', title: exam_title });
    // if (COURSE.status == 404) {
    //     console.log(`未找到題庫: ${exam_title}`);
    // } else {
    //     console.log(`找到題庫: ${COURSE._id} (${!COURSE.Q ? 0 : Object.keys(COURSE.Q).length}) `);
    //     // 讀取題目並填入答案
    //     $('div.question_warp').each(function (id, val) {
    //         let qTitle = $(this).find('h3').text();
    //         qTitle = qTitle.substring(qTitle.indexOf('. ', 0) + 2);
    //         // 題庫有這題
    //         try {
    //             if (COURSE.Q[qTitle]) {
    //                 let answers = COURSE.Q[qTitle];
    //                 //console.log(answers);
    //                 // 是非題
    //                 if (answers.length == 1) {
    //                     if (answers[0] == '正确') {
    //                         $(this).find('input[value=1]')[0].checked = true;
    //                         $('#a' + (id + 1)).addClass('active');
    //                     } else if (answers[0] == '错误') {
    //                         $(this).find('input[value=0]')[0].checked = true;
    //                         $('#a' + (id + 1)).addClass('active');
    //                     }
    //                     //console.log("答題 " + (id+1) +": " + answers[0]);
    //                 }
    //                 // 選擇題
    //                 $(this)
    //                     .find('input')
    //                     .each(function (i, v) {
    //                         let opt = $(this).parent()[0].innerText;
    //                         opt = opt.substring(opt.indexOf('： ', 0) + 2);
    //                         if (answers.includes(opt)) {
    //                             $(this).attr('checked', true);
    //                             $('#a' + (id + 1)).addClass('active');
    //                             //console.log("答題 " + (id+1) +": 勾選 " + opt);
    //                         }
    //                     });
    //             }
    //         } catch {}
    //     });
    // }
})();
