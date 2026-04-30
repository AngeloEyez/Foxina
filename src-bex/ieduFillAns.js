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

// ─── 監聽來自 MAIN World 的工號訊息（由 background requestPageBridge 注入） ────
// background.js 會使用 chrome.scripting.executeScript 在 MAIN world 讀取
// window.userName，再透過 postMessage 傳送至此 ISOLATED World Content Script。
window.addEventListener('message', function (event) {
    if (event.data.type === 'FOXINA_USER_INFO') {
        const userName = event.data.userName;
        if (userName) {
            console.log(`[ieduFillAns] 從頁面獲取到工號: ${userName}`);
            chrome.storage.local.get('foxinaOpt', items => {
                if (items.foxinaOpt) {
                    let opt = JSON.parse(items.foxinaOpt);
                    if (opt.user && opt.user.empId !== userName) {
                        opt.user.empId = userName;
                        chrome.storage.local.set({ foxinaOpt: JSON.stringify(opt) });
                    }
                }
            });
        }
    }
});

// 向 background 請求在 MAIN World 注入橋接函式以讀取 window.userName
// 使用 chrome.scripting.executeScript，完全符合 MV3 CSP 規範，無需 unsafe-inline
chrome.runtime.sendMessage({ action: 'requestPageBridge' }, response => {
    if (chrome.runtime.lastError) {
        console.warn('[ieduFillAns] requestPageBridge 失敗:', chrome.runtime.lastError.message);
    } else {
        console.log('[ieduFillAns] requestPageBridge 回應:', response);
    }
});

// ─── 文字處理輔助函式（與 ieduGetAns.js 保持同步）────────────────────────
/**
 * 正規化文字：將所有連續空白字元壓縮為單一空格並去頭尾空白。
 * 用於相容 iedu 頁面內含 \n\t 的選項文字。
 * @param {string} text - 待正規化的原始文字
 * @returns {string} 正規化後的文字
 */
function normalizeText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * 去除選項前綴（如 "A："、"B: " 等），回傳純選項內容。
 * 支援全形/半形冒號、有無空格等各種變體。
 * @param {string} text - 已正規化的選項文字
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

// ─── 主流程：整合課程 ID 寫入 + 自動填答 ─────────────────────────────────
// 【重構說明】原本兩個 IIFE 並行執行，導致每次進入考試頁都會無條件呼叫
//   putCourse，產生無意義的上傳統計與不必要的 DB 寫入。
//   現改為單一有序流程：
//     1. 先 getCourse 查詢題庫
//     2. 依結果決定是否需要 putCourse（只在課程不存在或 courseId 缺失時才呼叫）
//     3. 再進行自動填答
//   此改動確保 upload 統計與 DB timestamp 只在真正有新資料寫入時才更新。
(async () => {
    // ── 步驟 0：讀取設定與頁面基本資訊 ──────────────────────────────────
    let storageItems = await chrome.storage.local.get('foxinaOpt');
    opt = storageItems.foxinaOpt ? JSON.parse(storageItems.foxinaOpt) : {};
    const fillEnabled = !!opt?.iedu?.fillAns;
    const creatorId = opt?.user?.empId || '';

    let exam_title = $('div.exam_title h2').text().trim();
    console.log(`[ieduFillAns] 課程標題: "${exam_title}"`);

    if (!exam_title) {
        console.warn('[ieduFillAns] 無法取得考試標題，可能 DOM 尚未就緒，中止流程。');
        return;
    }

    // ── 步驟 1：先查詢 DB 中是否已有此課程的題庫 ─────────────────────────
    console.log(`[ieduFillAns] 查詢 DB 題庫: "${exam_title}"...`);
    const COURSE = await chrome.runtime.sendMessage({ action: 'getCourse', title: exam_title });
    const courseFound = COURSE && !COURSE.error && COURSE.status !== 404;

    // ── 步驟 2：決定是否需要 putCourse ───────────────────────────────────
    // 只在以下兩種情況才呼叫 putCourse（才有實際意義）：
    //   A. 課程在 DB 中完全不存在 → 需要建立骨架文件，等 ieduGetAns.js 後續填入題目
    //   B. 課程存在但 courseId 欄位缺失 → 需要補齊後設資料
    // 其他情況（課程已存在且 courseId 完整）跳過，避免無意義的寫入與上傳統計。
    const courseId = await chrome.runtime.sendMessage({ action: 'getCourseID' });

    if (courseId == 0) {
        console.warn('[ieduFillAns] 無法取得 courseID，跳過後設資料寫入。');
    } else if (!courseFound) {
        // 情況 A：課程不存在，建立骨架文件
        console.log(`[ieduFillAns] 課程不存在於 DB，建立骨架: courseId=${courseId}`);
        const res = await chrome.runtime.sendMessage({
            action: 'putCourse',
            doc: { _id: exam_title, site: 'iedu', courseId: courseId, creatorId: creatorId }
        });
        console.log('[ieduFillAns] putCourse（新建骨架）回應:', res?.msg ?? res);
    } else if (!COURSE.courseId) {
        // 情況 B：課程存在但 courseId 缺失，補齊後設資料
        console.log(`[ieduFillAns] 課程存在但缺少 courseId，補寫: courseId=${courseId}`);
        const res = await chrome.runtime.sendMessage({
            action: 'putCourse',
            doc: { _id: exam_title, site: 'iedu', courseId: courseId, creatorId: creatorId }
        });
        console.log('[ieduFillAns] putCourse（補寫 courseId）回應:', res?.msg ?? res);
    } else {
        // 情況 C：課程完整，無需 putCourse
        console.log(`[ieduFillAns] 課程資料完整（courseId=${COURSE.courseId}），跳過 putCourse。`);
    }

    // ── 步驟 3：自動填答（依設定開關決定是否執行）────────────────────────
    if (!fillEnabled) {
        console.log('[ieduFillAns] fillAns 功能已關閉，跳過自動填答。');
        return;
    }

    if (!courseFound) {
        console.warn(`[ieduFillAns] [fillAns] ❌ DB 中無題庫，無法自動填答: "${exam_title}"`);
        return;
    }

    // 【修正】原本只判斷 status==404，若遠端/本地均找不到課程，
    //         getCourse 回傳的是 PouchDB 的 error 物件（含 error 屬性），
    //         應改用 COURSE.error 或 COURSE.status 做更全面的判斷。
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

                // ─── 是非題（答案為「正确」/「错误」，直接找對應 value 的 input） ───
                // 判斷是否為是非題：答案只有一個且為 正确/错误
                const judgmentVals = { '正确': '1', '错误': '0' };
                if (answers.length === 1 && judgmentVals[answers[0]] !== undefined) {
                    const inputVal = judgmentVals[answers[0]];
                    setTimeout(() => {
                        const $input = $(this).find(`input[value="${inputVal}"]`);
                        if ($input.length > 0) {
                            $input[0].click();
                        } else {
                            console.warn(`[ieduFillAns] [fillAns] ⚠️ 找不到是非題 input[value=${inputVal}]`);
                        }
                    }, 100);
                    // 是非題處理完畢，不繼續執行選擇題邏輯
                    filledCount++;
                    return;
                }

                // ─── 選擇題（比對選項文字後直接點擊 input 元素） ─────────────────
                // 【修正】對 DB 中的答案値也做正規化，相容舊版含 \n\t 的髒資料
                const normalizedAnswers = answers.map(a => stripOptionPrefix(normalizeText(a)));
                let clickDelay = 100;
                $(this)
                    .find('input')
                    .each(function () {
                        let $input = $(this);
                        let $parent = $input.parent();
                        if ($parent.length === 0) return;

                        // 【修正】先正規化空白，再去前綴，與 ieduGetAns.js 保持同步
                        let optText = normalizeText($parent.text());
                        optText = stripOptionPrefix(optText);

                        if (normalizedAnswers.includes(optText)) {
                            // 遞增延遲，防止多選題同時點擊產生競態
                            const delay = clickDelay;
                            setTimeout(() => {
                                $input[0].click();
                            }, delay);
                            clickDelay += 50;
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
