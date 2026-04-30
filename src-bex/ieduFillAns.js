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

// ─── 取得課程 ID 並寫入 DB ────────────────────────────────────────────────
(async () => {
    // 在 async 內取得標題，確保 DOM 已載入
    let exam_title = $('div.exam_title h2').text().trim();
    console.log(`[ieduFillAns] 課程標題: "${exam_title}"`);

    if (!exam_title) {
        console.warn('[ieduFillAns] 無法取得考試標題，可能 DOM 尚未就緒，跳過課程 ID 寫入。');
        return;
    }

    let courseId = await chrome.runtime.sendMessage({ action: 'getCourseID' });
    if (courseId == 0) {
        console.warn("[ieduFillAns] 無法取得 courseID，跳過課程 ID 寫入。");
    } else {
        console.log('[ieduFillAns] 取得 CourseID: ' + courseId + '，準備寫入 DB...');
        const response = await chrome.runtime.sendMessage({
            action: 'putCourse',
            doc: {
                _id: exam_title,
                site: 'iedu',
                courseId: courseId
            }
        });
        console.log('[ieduFillAns] putCourse 回應:', response?.msg ?? response);
    }
})();

// ─── 自動填答主流程 ───────────────────────────────────────────────────────
(async () => {
    // 讀取設定
    let storageItems = await chrome.storage.local.get('foxinaOpt');
    opt = JSON.parse(storageItems.foxinaOpt);
    if (!opt?.iedu?.fillAns) {
        console.log('[ieduFillAns] fillAns 功能已關閉，跳過自動填答。');
        return;
    }

    // 在 async 內取得標題，確保 DOM 已載入
    // 【修正】原本在全域層取值，若頁面尚未完全渲染會取到空字串
    let exam_title = $('div.exam_title h2').text().trim();
    console.log(`[ieduFillAns] [fillAns] 課程標題: "${exam_title}"`);

    if (!exam_title) {
        console.warn('[ieduFillAns] [fillAns] 無法取得考試標題，中止自動填答。');
        return;
    }

    console.log(`[ieduFillAns] [fillAns] 向 background 查詢課程題庫: "${exam_title}"...`);
    const COURSE = await chrome.runtime.sendMessage({ action: 'getCourse', title: exam_title });

    // 【修正】原本只判斷 status==404，若遠端/本地均找不到課程，
    //         getCourse 回傳的是 PouchDB 的 error 物件（含 error 屬性），
    //         應改用 COURSE.error 或 COURSE.status 做更全面的判斷。
    if (!COURSE || COURSE.error || COURSE.status === 404) {
        console.warn(`[ieduFillAns] [fillAns] ❌ 未找到題庫 (error: ${COURSE?.error ?? 'N/A'}, status: ${COURSE?.status ?? 'N/A'}): "${exam_title}"`);
        return;
    }

    const qCount = COURSE.Q ? Object.keys(COURSE.Q).length : 0;
    console.log(`[ieduFillAns] [fillAns] ✅ 找到題庫: "${COURSE._id}" | 共 ${qCount} 題`);

    if (qCount === 0) {
        console.warn('[ieduFillAns] [fillAns] ⚠️ 題庫存在但無題目 (Q 為空)，中止自動填答。');
        return;
    }

    // 讀取題目並填入答案
    let filledCount = 0;
    let skippedCount = 0;

    $('div.question_warp').each(function (id, val) {
        let qTitle = $(this).find('h3').text();
        qTitle = qTitle.substring(qTitle.indexOf('. ', 0) + 2).trim();

        // 題庫有這題
        try {
            if (COURSE.Q[qTitle]) {
                let answers = COURSE.Q[qTitle];
                console.log(`[ieduFillAns] [fillAns] 第 ${id + 1} 題填答: "${qTitle}" → ${JSON.stringify(answers)}`);

                // 是非題（答案只有一個且為「正确」/「错误」）
                if (answers.length == 1) {
                    if (answers[0] == '正确') {
                        setTimeout(() => $(this).find('input[value=1]')[0].click(), 100);
                    } else if (answers[0] == '错误') {
                        setTimeout(() => $(this).find('input[value=0]')[0].click(), 100);
                    }
                }

                // 選擇題（比對選項文字後點擊）
                $(this)
                    .find('input')
                    .each(function (i, v) {
                        let optText = $(this).parent()[0].innerText;
                        optText = optText.substring(optText.indexOf('： ', 0) + 2).trim();
                        if (answers.includes(optText)) {
                            setTimeout(() => $(this).parent()[0].click(), 100);
                        }
                    });

                filledCount++;
            } else {
                console.warn(`[ieduFillAns] [fillAns] ⚠️ 題庫無此題，跳過: "${qTitle}"`);
                skippedCount++;
            }
        } catch (e) {
            console.error(`[ieduFillAns] [fillAns] ❌ 填答第 ${id + 1} 題時發生錯誤:`, e);
        }
    });

    console.log(`[ieduFillAns] [fillAns] 填答完成 | 已填: ${filledCount} 題 | 跳過: ${skippedCount} 題`);
})();

// ─── 監聽送出按鈕並暫存當前答案 ─────────────────────────────────────────
$(document).on('click', 'button.btn-success', function () {
    console.log('[ieduFillAns] 偵測到點擊送出，正在暫存當前答案...');
    let tempAnswers = {};

    $('div.question_warp').each(function () {
        // 取得題目文字，去除編號
        let qTitle = $(this).find('h3').text();
        qTitle = qTitle.substring(qTitle.indexOf('. ', 0) + 2).trim();

        let answers = [];
        // 找出所有被選中的 input
        $(this).find('input:checked').each(function () {
            // 取得選項文字，例如 "A：正確" -> "正確"
            let optText = $(this).parent().text().trim();
            if (optText.includes('： ')) {
                optText = optText.substring(optText.indexOf('： ') + 2).trim();
            }
            answers.push(optText);
        });

        if (answers.length > 0) {
            tempAnswers[qTitle] = answers;
        }
    });

    // 存入 chrome.storage.local
    chrome.storage.local.set({ iedu_temp_answers: tempAnswers }, function () {
        console.log('[ieduFillAns] 答案已暫存:', tempAnswers);
    });
});
