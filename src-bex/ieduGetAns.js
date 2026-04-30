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

/**
 * 正規化文字：將所有連續空白字元（空格、Tab、換行等）壓縮為單一空格並去頭尾空白。
 * 用於解決 iedu 頁面中選項文字含有 \n\t 縮排，導致去前綴邏輯失效的問題。
 * @param {string} text - 待正規化的原始文字
 * @returns {string} 正規化後的文字
 */
function normalizeText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * 去除選項前綴（如 "A："、"B: " 等），回傳純選項內容。
 * 支援全形/半形冒號、有無空格等各種變體。
 * @param {string} text - 已正規化的選項文字（不含多餘空白）
 * @returns {string} 去除前綴後的選項內容
 */
function stripOptionPrefix(text) {
    // 匹配 "X： " 或 "X: "（冒號後有空格）
    const matchWithSpace = text.match(/^[A-Za-z]\uff1a\s|^[A-Za-z]:\s/);
    if (matchWithSpace) {
        return text.substring(matchWithSpace[0].length).trim();
    }
    // 匹配 "X：" 或 "X:"（冒號後無空格）
    const matchNoSpace = text.match(/^[A-Za-z][\uff1a:]/);
    if (matchNoSpace) {
        return text.substring(matchNoSpace[0].length).trim();
    }
    return text;
}

let Q = {};
// 讀取 題目/答案
$('div.question_warp').each(function (index, val) {
    let qTitle = $(this).find('h3').text();
    qTitle = qTitle.substring(qTitle.indexOf('. ', 0) + 2).trim();

    let ans = $(this).find('p.answer > strong:first').text().trim();
    let answers = [];

    // 判斷是否為是非題 (支援中英繁)
    const judgmentMap = {
        '正确': '正确', '正確': '正确', 'YES': '正确', 'Correct': '正确', '1': '正确',
        '错误': '错误', '錯誤': '错误', 'NO': '错误', 'Incorrect': '错误', '0': '错误'
    };

    if (judgmentMap[ans]) {
        answers.push(judgmentMap[ans]);
    } else {
        // 選擇題 (通常 ans 為 A, B, ABC 等)
        ans.split('').forEach(function (v) {
            try {
                let $input = $(this).find('input[value="' + v + '"]');
                let optText = '';

                if ($input.length > 0 && $input.parent().length > 0) {
                    // 【修正】先正規化空白，再去前綴，防止 \n\t 導致前綴判斷失效
                    optText = normalizeText($input.parent().text());
                } else {
                    // Fallback: 尋找以 v 開頭的 label (例如 "A：選項內容")
                    $(this).find('label').each(function () {
                        let labelText = normalizeText($(this).text());
                        if (labelText.startsWith(v + '：') || labelText.startsWith(v + ':')) {
                            optText = labelText;
                            return false; // break
                        }
                    });
                }

                if (optText) {
                    // 【修正】使用 stripOptionPrefix() 取代原本四個 if/else 的硬判斷
                    optText = stripOptionPrefix(optText);
                    if (optText) answers.push(optText);
                }
            } catch (e) {
                console.error(`[ieduGetAns] 處理選項 ${v} 時出錯:`, e);
            }
        }.bind(this));
    }
    Q[qTitle] = answers;
});
//console.log(Q);

(async () => {
    // --- 新增功能：檢查分數並決定是否使用暫存答案 ---
    // 支援多國語言的分數偵測 (優先使用使用者建議的 .exam_result strong)
    let score = 0;
    let scoreText = '';

    // 1. 優先嘗試 div.exam_result 內的 strong
    let $scoreStrong = $('.exam_result strong');
    if ($scoreStrong.length > 0) {
        scoreText = $scoreStrong.first().text().trim();
    }

    // 2. 次要嘗試 .score_text
    if (!scoreText) {
        scoreText = $('.score_text').text().trim();
    }

    // 3. 最後嘗試關鍵字搜尋 (Fallback)
    if (!scoreText) {
        $('div, p, span, strong').each(function () {
            let text = $(this).text().trim();
            if (text.includes('Score') || text.includes('成績') || text.includes('成绩')) {
                scoreText = text;
                return false; // break
            }
        });
    }

    if (scoreText) {
        let scoreMatch = scoreText.match(/\d+/);
        score = scoreMatch ? parseInt(scoreMatch[0]) : 0;
    }

    console.log(`[ieduGetAns] 偵測到分數: ${score} (來源文字: "${scoreText}")`);

    if (score === 100) {
        // 讀取暫存答案
        let storage = await chrome.storage.local.get('iedu_temp_answers');
        if (storage.iedu_temp_answers) {
            console.log('[ieduGetAns] 分數滿分，直接使用暫存答案儲存。');
            Q = storage.iedu_temp_answers;
        } else {
            console.log('[ieduGetAns] 分數滿分，但未找到暫存答案，使用頁面抓取結果。');
        }
    }

    // 取得當前工號
    let storageOpt = await chrome.storage.local.get('foxinaOpt');
    let creatorId = '';
    if (storageOpt.foxinaOpt) {
        try {
            creatorId = JSON.parse(storageOpt.foxinaOpt).user?.empId || '';
        } catch (e) {}
    }

    const response = await chrome.runtime.sendMessage({
        action: 'putCourse',
        doc: {
            _id: exam_title,
            site: 'iedu',
            Q: Q,
            creatorId: creatorId
        }
    });

    console.log('[ieduGetAns] 答案已存入資料庫:', response);

    // 清除暫存
    chrome.storage.local.remove('iedu_temp_answers');
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
