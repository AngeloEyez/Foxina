import { bexBackground } from 'quasar/wrappers';

console.log('========================= Background Page Start ==============================');

// chrome.runtime.onInstalled.addListener(() => {
//     chrome.action.onClicked.addListener((/* tab */) => {
//         // Opens our extension in a new browser window.
//         // Only if a popup isn't defined in the manifest.
//         chrome.tabs.create(
//             {
//                 url: chrome.runtime.getURL('www/index.html')
//             },
//             (/* newTab */) => {
//                 // Tab opened.
//             }
//         );
//     });
// });

export default bexBackground((bridge /* , allActiveConnections */) => {
    bridge.on('log', ({ data, respond }) => {
        console.log(`[BEX] ${data.message}`, ...(data.data || []));
        respond('Log OK!');
    });

    bridge.on('blog.1', ({ data, respond }) => {
        console.log(`[BEX] ${data.message}`, ...(data.data || []));
        respond('Log1 OK!');
    });

    //bridge.send('whatsnew.close', { key: 'someKey', value: 'someValue' });

    bridge.on('getTime', ({ respond }) => {
        respond(Date.now());
    });

    bridge.on('storage.get', ({ data, respond }) => {
        const { key } = data;
        if (key === null) {
            chrome.storage.local.get(null, items => {
                // Group the values up into an array to take advantage of the bridge's chunk splitting.
                respond(Object.values(items));
            });
        } else {
            chrome.storage.local.get([key], items => {
                respond(items[key]);
            });
        }
    });
    // Usage:
    // const { data } = await bridge.send('storage.get', { key: 'someKey' })

    bridge.on('storage.set', ({ data, respond }) => {
        chrome.storage.local.set({ [data.key]: data.value }, () => {
            respond(true);
        });
    });
    // Usage:
    // await bridge.send('storage.set', { key: 'someKey', value: 'someValue' })

    bridge.on('storage.remove', ({ data, respond }) => {
        chrome.storage.local.remove(data.key, () => {
            respond();
        });
    });
    // Usage:
    // await bridge.send('storage.remove', { key: 'someKey' })

    /*
  // EXAMPLES
  // Listen to a message from the client
  bridge.on('test', d => {
    console.log(d)
  })

  // Send a message to the client based on something happening.
  chrome.tabs.onCreated.addListener(tab => {
    bridge.send('browserTabCreated', { tab })
  })

  // Send a message to the client based on something happening.
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      bridge.send('browserTabUpdated', { tab, changeInfo })
    }
  })
   */
});

// =====================================================================================
// iedu stuff
// =====================================================================================
const PouchDB = require('./modules/pouchdb-8.0.0.min.js');

const _LOCALDB = 'fxn_iedu';
const _REMOTEDB = "http://fxn:Youcan'tgetthepassword!@218.35.162.28:5984/fxn_iedu";

let db = new PouchDB(_LOCALDB);
let rdb = new PouchDB(_REMOTEDB);
let lastSyncTime = null;

// ─── 網路攔截：監聽 submitExam 請求以獲取工號 (userName) ──────────────────────
chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
        if (details.method === 'POST' && details.requestBody) {
            try {
                let userName = null;
                // 嘗試從 formData 獲取 (如果是表單格式)
                if (details.requestBody.formData) {
                    if (details.requestBody.formData.userName) {
                        userName = details.requestBody.formData.userName[0];
                    }
                }
                // 嘗試從 raw 資料獲取 (如果是 JSON 格式)
                else if (details.requestBody.raw) {
                    const decoder = new TextDecoder('utf-8');
                    const rawData = details.requestBody.raw
                        .map(data => {
                            if (data.bytes) return decoder.decode(data.bytes);
                            return '';
                        })
                        .join('');

                    // 嘗試解析 JSON 或簡單的 key=value
                    if (rawData.includes('userName=')) {
                        const match = rawData.match(/userName=([^&]+)/);
                        if (match) userName = decodeURIComponent(match[1]);
                    } else {
                        try {
                            const json = JSON.parse(rawData);
                            if (json.userName) userName = json.userName;
                        } catch (e) {}
                    }
                }

                if (userName) {
                    console.log(`[Background] 攔截到工號: ${userName}`);
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
            } catch (err) {
                console.error('[Background] 解析請求 Payload 失敗', err);
            }
        }
    },
    { urls: ['*://iedu.foxconn.com/*/submitExam*', '*://iedu.foxconn.com/*/submitExamTask*'] },
    ['requestBody']
);

/** 執行鎖：防止 pushDB() 並行執行造成競爭條件 (Race Condition) */
let isPushingDB = false;

pushDB();

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.action) {
        case 'triggerSync': {
            console.log('[triggerSync] 手動觸發同步');
            // 通知UI同步已開始
            broadcastSyncStatus('syncing');

            // 執行同步
            try {
                syncdb()
                    .then(() => {
                        console.log('[triggerSync] 同步完成');
                        lastSyncTime = Date.now();
                        broadcastSyncStatus('completed');
                        sendResponse({ success: true });
                    })
                    .catch(err => {
                        console.log('[triggerSync] 同步錯誤', err);
                        broadcastSyncStatus('error');
                        sendResponse({ error: err });
                    });
            } catch (error) {
                console.error('[triggerSync] 同步過程發生異常', error);
                broadcastSyncStatus('error');
                sendResponse({ error: error });
            }
            break;
        }

        case 'getLastSyncTime': {
            console.log('[getLastSyncTime] 獲取上次同步時間');
            sendResponse({ time: lastSyncTime });
            break;
        }

        case 'triggerPushDB': {
            console.log('[triggerPushDB] UI 手動觸發精確同步 (pushDB)...');
            broadcastSyncStatus('syncing');

            pushDB()
                .then(() => {
                    console.log('[triggerPushDB] pushDB 完成');
                    sendResponse({ success: true });
                })
                .catch(err => {
                    console.error('[triggerPushDB] pushDB 失敗', err);
                    sendResponse({ error: String(err) });
                });
            break;
        }

        case 'getAllLocalDocs': {
            console.log(`[getAllLocalDocs] 獲取所有本地數據`);
            db.allDocs({ include_docs: true })
                .then(function (result) {
                    // 過濾掉 meta_ 開頭的內部管理文件，只回傳課程資料
                    result.rows = result.rows.filter(r => !r.id.startsWith('meta_'));
                    sendResponse(result);
                })
                .catch(function (err) {
                    console.log(err);
                    sendResponse({ error: err });
                });
            break;
        }

        case 'getAllRemoteDocs': {
            console.log(`[getAllRemoteDocs] 獲取所有遠端數據`);
            rdb.allDocs({ include_docs: true })
                .then(function (result) {
                    // 過濾掉 meta_ 開頭的內部管理文件，只回傳課程資料
                    result.rows = result.rows.filter(r => !r.id.startsWith('meta_'));
                    sendResponse(result);
                })
                .catch(function (err) {
                    console.log(err);
                    sendResponse({ error: err });
                });
            break;
        }

        /**
         * 獲取工號使用統計資料
         * 優先從遠端 DB 讀取，失敗則 fallback 至本地 DB
         */
        case 'getEmpStats': {
            console.log('[getEmpStats] 獲取工號統計...');
            rdb.get('meta_empStats')
                .then(doc => {
                    console.log('[getEmpStats] 從遠端取得工號統計');
                    sendResponse({ stats: doc.stats || {} });
                })
                .catch(() => {
                    // 遠端失敗，改查本地
                    db.get('meta_empStats')
                        .then(doc => {
                            console.log('[getEmpStats] 從本地取得工號統計');
                            sendResponse({ stats: doc.stats || {} });
                        })
                        .catch(() => {
                            console.log('[getEmpStats] 尚無統計資料');
                            sendResponse({ stats: {} });
                        });
                });
            break;
        }

        case 'getCourse': {
            const _courseTitle = request.title;
            console.log(`[getCourse] 開始查詢課程: "${_courseTitle}"`);

            // 步驟 1: 優先查詢遠端資料庫（包含最完整的題庫）
            rdb.get(_courseTitle)
                .then(function (doc) {
                    const qCount = doc.Q ? Object.keys(doc.Q).length : 0;
                    console.log(`[getCourse] ✅ 遠端找到課程: "${doc._id}" | 題庫數量: ${qCount} 題`);
                    if (qCount === 0) {
                        console.warn(`[getCourse] ⚠️ 遠端課程存在但 Q 欄位為空，無法填答。`);
                    }
                    sendResponse(doc);
                })
                .catch(function (remoteErr) {
                    // 遠端查詢失敗（離線或 404），改查本地資料庫
                    const remoteErrReason = remoteErr.status === 404 ? '不存在 (404)' : `連線錯誤 (${remoteErr.message || remoteErr.name})`;
                    console.warn(`[getCourse] ⚠️ 遠端查詢失敗 (${remoteErrReason})，改查本地資料庫...`);

                    // 步驟 2: 本地資料庫 fallback
                    db.get(_courseTitle)
                        .then(function (doc) {
                            const qCount = doc.Q ? Object.keys(doc.Q).length : 0;
                            console.log(`[getCourse] ✅ 本地找到課程: "${doc._id}" | 題庫數量: ${qCount} 題`);
                            if (qCount === 0) {
                                console.warn(`[getCourse] ⚠️ 本地課程存在但 Q 欄位為空，無法填答。`);
                            }
                            sendResponse(doc);
                        })
                        .catch(e => {
                            const localErrReason = e.status === 404 ? '不存在 (404)' : `查詢錯誤 (${e.message || e.name})`;
                            console.error(`[getCourse] ❌ 本地查詢也失敗 (${localErrReason})，課程完全未找到: "${_courseTitle}"`);
                            sendResponse(e);
                        });
                });
            break;
        }

        // 寫入題庫 =================================================
        case 'putCourse': {
            let upd = request.doc;
            // 先查詢 DB 是否有相同課程
            console.log(`[putCourse]查詢 本地DB 是否已有此課程: ${upd._id}`);

            db.get(upd._id)
                .then(function (doc) {
                    console.log('本地找到課程, 合併題庫準備更新...');

                    let cnt = mergeDoc(doc, upd);

                    // 數據有更新, 才更新資料庫
                    if (cnt > 0) {
                        db.put(doc)
                            .then(res => {
                                console.log(`本地更新 ${cnt} 個資料成功: ${doc._id}`);
                                pushDB();
                                // 更新工號使用統計
                                if (upd.creatorId) updateEmpStats(upd.creatorId);
                                sendResponse({ msg: `本地更新 ${cnt} 個資料成功: ${doc._id}` });
                            })
                            .catch(err => {
                                console.log(`本地更新 ${cnt} 個資料失敗: ${doc._id}`);
                                console.log(err);
                                sendResponse({ msg: `本地更新 ${cnt} 個資料失敗: ${doc._id}`, err: err });
                            });
                    } else {
                        console.log('本地資料不須更新');
                        // 即使資料不須更新，也要更新工號使用統計（記錄此次查詢）
                        if (upd.creatorId) updateEmpStats(upd.creatorId);
                        sendResponse({ msg: `本地資料不須更新: ${doc._id}` });
                    }
                })
                .catch(function (err) {
                    if (err.status == 404) {
                        console.log('本地未找到課程, 準備新增...');

                        db.put(upd)
                            .then(res => {
                                console.log(`本地課程新增成功: ${upd._id}`);
                                if (upd.Q != undefined) {
                                    pushDB();
                                }
                                // 更新工號使用統計
                                if (upd.creatorId) updateEmpStats(upd.creatorId);
                                sendResponse({ msg: `本地課程新增成功: ${upd._id}` });
                            })
                            .catch(err => {
                                console.log(`本地課程新增失敗: ${upd._id}`);
                                console.log(err);
                                sendResponse({ msg: `本地課程新增失敗: ${upd._id}`, err: err });
                            });
                    } else {
                        console.log('未知錯誤!');
                        console.log(err);
                        sendResponse({ msg: '未知錯誤!', err: err });
                    }
                });
            break;
        }

        case 'getCourseID': {
            chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tabs]) => {
                try {
                    let url = tabs.url;
                    if (url.indexOf('courseId=') > -1) {
                        sendResponse(url.substring(url.indexOf('courseId=') + 9, url.length));
                    } else {
                        sendResponse(url.substring(url.indexOf('itemId=') + 7, url.length));
                    }
                } catch {
                    sendResponse(0);
                }
            });
            break;
        }

        case 'deleteLocalDoc': {
            console.log(`[deleteLocalDoc] 刪除本地文檔: ${request.id}`);
            db.remove(request.id, request.rev)
                .then(function (response) {
                    console.log(`[deleteLocalDoc] 刪除成功`, response);
                    sendResponse(response);
                })
                .catch(function (error) {
                    console.log(`[deleteLocalDoc] 刪除失敗`, error);
                    sendResponse({ error: error.message || '刪除失敗' });
                });
            break;
        }

        case 'deleteRemoteDoc': {
            console.log(`[deleteRemoteDoc] 刪除遠端文檔: ${request.id}`);
            rdb.remove(request.id, request.rev)
                .then(function (response) {
                    console.log(`[deleteRemoteDoc] 刪除成功`, response);
                    sendResponse(response);
                })
                .catch(function (error) {
                    console.log(`[deleteRemoteDoc] 刪除失敗`, error);
                    sendResponse({ error: error.message || '刪除失敗' });
                });
            break;
        }

        /**
         * 在頁面的 MAIN World 中注入橋接函式，讀取 window.userName 後透過 postMessage 傳送。
         * 使用 chrome.scripting.executeScript 取代 inline script，完全符合 MV3 CSP 規範。
         * Content Script (ieduFillAns.js) 無法直接存取頁面的 window，須由此代為注入。
         * @requires scripting 權限
         */
        case 'requestPageBridge': {
            const tabId = sender?.tab?.id;
            if (!tabId) {
                console.warn('[requestPageBridge] 無法取得 tabId，跳過注入。');
                sendResponse({ error: 'no tabId' });
                break;
            }

            chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',
                /**
                 * 在 MAIN World 執行的函式：讀取頁面全域變數 window.userName
                 * 並透過 postMessage 傳送至 ISOLATED World 的 Content Script。
                 */
                func: function () {
                    const userName = window.userName || '';
                    window.postMessage({ type: 'FOXINA_USER_INFO', userName: userName }, '*');
                }
            })
                .then(() => {
                    console.log('[requestPageBridge] MAIN World 注入成功。');
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    console.error('[requestPageBridge] 注入失敗:', err);
                    sendResponse({ error: String(err) });
                });
            break;
        }



        /**
         * 清理 DB 中含有 \n\t 的髒答案資料（前綴未去除、空白未正規化）。
         * 掃描遠端 DB 所有課程文件，對每個答案值執行 normalizeText + stripOptionPrefix，
         * 若有修正則更新並回傳修正統計。
         */
        case 'cleanupAnswers': {
            console.log('[cleanupAnswers] 開始掃描並清理髒答案資料...');

            /**
             * 正規化文字（與 ieduGetAns.js 邏輯保持同步）
             * @param {string} text
             * @returns {string}
             */
            function _normalizeText(text) {
                return text.replace(/\s+/g, ' ').trim();
            }

            /**
             * 去除選項前綴（如 "A："、"B: " 等）
             * @param {string} text
             * @returns {string}
             */
            function _stripOptionPrefix(text) {
                const matchWithSpace = text.match(/^[A-Za-z]\uff1a\s|^[A-Za-z]:\s/);
                if (matchWithSpace) return text.substring(matchWithSpace[0].length).trim();
                const matchNoSpace = text.match(/^[A-Za-z][\uff1a:]/);
                if (matchNoSpace) return text.substring(matchNoSpace[0].length).trim();
                return text;
            }

            rdb.allDocs({ include_docs: true })
                .then(function (result) {
                    let totalFixed = 0;
                    let totalQuestions = 0;
                    const docsToUpdate = [];

                    result.rows.forEach(row => {
                        const doc = row.doc;
                        // 跳過 meta_ 內部文件
                        if (!doc || !doc.Q || doc._id.startsWith('meta_')) return;

                        let docDirty = false;
                        Object.entries(doc.Q).forEach(([qTitle, answers]) => {
                            if (!Array.isArray(answers)) return;
                            totalQuestions++;
                            const cleaned = answers.map(a => _stripOptionPrefix(_normalizeText(a)));
                            // 比較是否有變化
                            if (JSON.stringify(cleaned) !== JSON.stringify(answers)) {
                                doc.Q[qTitle] = cleaned;
                                docDirty = true;
                                totalFixed++;
                                console.log(`[cleanupAnswers] 修正: "${doc._id}" → Q["${qTitle}"]`);
                                console.log('  舊值:', JSON.stringify(answers));
                                console.log('  新值:', JSON.stringify(cleaned));
                            }
                        });

                        if (docDirty) docsToUpdate.push(doc);
                    });

                    if (docsToUpdate.length === 0) {
                        console.log(`[cleanupAnswers] 掃描 ${totalQuestions} 題，無需清理。`);
                        sendResponse({ fixed: 0, totalQuestions, updatedDocs: 0 });
                        return;
                    }

                    // 批次更新遠端
                    rdb.bulkDocs(docsToUpdate)
                        .then(bulkRes => {
                            const failures = bulkRes.filter(r => !r.ok);
                            console.log(`[cleanupAnswers] 完成！修正 ${totalFixed} 個答案，更新 ${docsToUpdate.length} 份文件，失敗 ${failures.length} 份。`);
                            sendResponse({
                                fixed: totalFixed,
                                totalQuestions,
                                updatedDocs: docsToUpdate.length,
                                failures: failures.length
                            });
                        })
                        .catch(err => {
                            console.error('[cleanupAnswers] bulkDocs 更新失敗:', err);
                            sendResponse({ error: String(err) });
                        });
                })
                .catch(function (err) {
                    console.error('[cleanupAnswers] 讀取遠端 DB 失敗:', err);
                    sendResponse({ error: String(err) });
                });
            break;
        }


        default: {
            //var key = await getKey();
            break;
        }
    }

    return true;
});

// 廣播同步狀態給所有頁面
function broadcastSyncStatus(status) {
    chrome.runtime.sendMessage({ type: 'syncStatus', status: status }, response => {
        if (chrome.runtime.lastError) {
            // 靜默處理「接收端不存在」的錯誤，因為這代表 Popup/Options 沒打開，是正常的
            // console.log('[broadcastSyncStatus] 目前無接收端');
        }
    });
}

function syncdb() {
    console.log(`Start sync...`);
    return new Promise((resolve, reject) => {
        var sync = PouchDB.sync('fxn_iedu', "http://fxn:Youcan'tgetthepassword!@218.35.162.28:5984/fxn_iedu")
            .on('change', function (info) {
                //console.log('sync: change detected.');
                //console.log(info);
            })
            .on('paused', function (err) {
                //console.log('sync: paused detected.');
                //console.log(err);
            })
            .on('active', function () {
                //console.log('sync: active detected.');
                //console.log('active');
            })
            .on('denied', function (err) {
                console.log('Start sync... denied.');
                console.log(err);
                reject(err);
            })
            .on('complete', function (info) {
                console.log('Start sync... completed.');
                //console.log(info);
                resolve(info);
            })
            .on('error', function (err) {
                console.log("Start sync... error or can't connect!");
                console.log(err);
                reject(err);
            });
    });
}

//
// Merge Doc
// Merge upd content to doc and return number of modification as cnt.
//
function mergeDoc(doc, upd) {
    let cnt = 0;
    if (upd == undefined) {
        return cnt;
    }
    if (doc == undefined) {
        console.log('[mergeDoc()] doc can not be undefined');
    }

    if (doc.Q == undefined) {
        doc.Q = {};
    }
    if (doc._id == undefined) {
        doc._id = upd._id;
    }

    if (upd.Q != undefined) {
        Object.entries(upd.Q).forEach(obj => {
            // 比較陣列 合併題庫
            if (doc.Q[obj[0]] == undefined || !(doc.Q[obj[0]].length === obj[1].length && doc.Q[obj[0]].sort().toString() === obj[1].sort().toString())) {
                doc.Q[obj[0]] = obj[1];
                cnt++;
                doc.timestamp = new Date();
            }
        });
    }

    if (upd.courseId != undefined && doc.courseId != upd.courseId) {
        doc.courseId = upd.courseId;
        cnt++;
    }

    if (upd.site != undefined && doc.site != upd.site) {
        doc.site = upd.site;
        cnt++;
    }

    if (upd.creatorId != undefined && doc.creatorId != upd.creatorId) {
        doc.creatorId = upd.creatorId;
        cnt++;
    }

    return cnt;
}

/**
 * pushDB
 * 將本地 DB 的資料推送到遠端，並只刪除「確認已成功推送」的本地文件。
 * 包含執行鎖防止並行衝突。
 */
function pushDB() {
    // 若上一次 pushDB 尚未完成，直接跳過以防止競爭條件
    if (isPushingDB) {
        console.warn('[pushDB] 上一次 pushDB 尚未完成，跳過此次執行。');
        return Promise.resolve();
    }
    isPushingDB = true;
    console.log('[pushDB] 開始執行...');

    // 通知UI同步開始
    broadcastSyncStatus('syncing');

    return db
        .allDocs({ include_docs: true })
        .then(function (res) {
            // 從本地 DB 收集所有 _id
            let localDocs = res.rows.map(r => r.doc);
            let keys = localDocs.map(doc => doc._id);

            if (keys.length === 0) {
                // 本地 DB 無資料，直接視為完成
                console.log('[pushDB] 本地 DB 無資料，無需同步。');
                lastSyncTime = Date.now();
                broadcastSyncStatus('completed');
                return;
            }

            console.log(`[pushDB] 本地共有 ${keys.length} 筆文件待檢查: [${keys.join(', ')}]`);

            // 從遠端批次取得相對應的文件
            return rdb
                .allDocs({ include_docs: true, keys: keys })
                .then(rres => {
                    /** @type {Array<object>} 需要推送到遠端的合併後文件 */
                    let mDocs = [];
                    /**
                     * @type {Map<string, {_id: string, _rev: string}>}
                     * 記錄每個準備推送的遠端文件對應的本地文件資訊，
                     * 用於後續精確刪除本地已成功同步的文件。
                     */
                    let localDocMap = new Map();

                    /** @type {string[]} 本地資料已與遠端一致，無須推送但需從本地刪除的 ID */
                    let redundantIds = [];

                    // 逐一比對並合併本地與遠端資料
                    localDocs.forEach((localDoc, i) => {
                        const remoteRow = rres.rows[i];
                        
                        // 務必記錄所有本地文件的 rev，以便後續刪除
                        localDocMap.set(localDoc._id, { _id: localDoc._id, _rev: localDoc._rev });

                        if (remoteRow.error) {
                            console.log(`[pushDB] 遠端無此文件 (${remoteRow.key})，將新增。`);
                        }

                        let rdoc = remoteRow.doc ?? {};
                        let cnt = mergeDoc(rdoc, localDoc);

                        if (cnt > 0) {
                            mDocs.push(rdoc);
                            console.log(`[pushDB] 待推送 (遠端更新 ${cnt} 個欄位): ${rdoc._id}`);
                        } else {
                            redundantIds.push(localDoc._id);
                            console.log(`[pushDB] 資料已一致，無須推送: ${localDoc._id}`);
                        }
                    });

                    if (mDocs.length === 0) {
                        // 所有本地資料均已與遠端一致
                        console.log(`[pushDB] 所有本地資料 (${redundantIds.length} 筆) 均已與遠端同步，執行清理。`);
                        return deleteLocalDocs(redundantIds, localDocMap).then(() => {
                            lastSyncTime = Date.now();
                            broadcastSyncStatus('completed');
                        });
                    }

                    console.log(`[pushDB] 準備推送 ${mDocs.length} 筆文件至遠端，並清理 ${redundantIds.length} 筆冗餘文件...`);

                    // 推送合併後的資料到遠端 DB
                    return rdb
                        .bulkDocs(mDocs)
                        .then(bulkResults => {
                            // 逐筆確認遠端寫入結果
                            const successIds = [...redundantIds]; // 冗餘的直接算成功刪除清單
                            const failIds = [];

                            bulkResults.forEach(result => {
                                if (result.ok) {
                                    successIds.push(result.id);
                                } else {
                                    failIds.push({ id: result.id, error: result.reason || result.message });
                                }
                            });

                            if (failIds.length > 0) {
                                console.error(`[pushDB] 有 ${failIds.length} 筆文件推送失敗:`, JSON.stringify(failIds));
                            }

                            if (successIds.length === 0) {
                                console.error('[pushDB] 所有文件推送均失敗，不執行任何本地刪除。');
                                broadcastSyncStatus('error');
                                return;
                            }

                            console.log(`[pushDB] 遠端寫入成功 ${successIds.length} 筆: [${successIds.join(', ')}]`);

                            // 只刪除已確認推送成功的本地文件
                            return deleteLocalDocs(successIds, localDocMap).then(() => {
                                if (failIds.length > 0) {
                                    // 部分成功，部分失敗
                                    console.warn(`[pushDB] 部分完成: 成功 ${successIds.length} 筆，失敗 ${failIds.length} 筆。`);
                                    broadcastSyncStatus('error');
                                } else {
                                    // 全部成功
                                    lastSyncTime = Date.now();
                                    console.log('[pushDB] 全部完成。');
                                    broadcastSyncStatus('completed');
                                }
                            });
                        })
                        .catch(e => {
                            console.error('[pushDB] bulkDocs 發生嚴重錯誤，不執行任何本地刪除:', e);
                            broadcastSyncStatus('error');
                            throw e;
                        });
                })
                .catch(err => {
                    console.error('[pushDB] 取得遠端資料失敗:', err);
                    broadcastSyncStatus('error');
                    throw err;
                });
        })
        .catch(function (err) {
            console.error('[pushDB] 讀取本地 DB 失敗:', err);
            broadcastSyncStatus('error');
            throw err;
        })
        .finally(() => {
            // 無論成功或失敗，都釋放執行鎖
            isPushingDB = false;
            console.log('[pushDB] 執行鎖已釋放。');
        });
}

/**
 * deleteLocalDocs
 * 精確刪除指定的本地文件，取代原本摧毀整個 DB 的做法。
 * @param {string[]} successIds - 已確認推送成功的文件 _id 陣列
 * @param {Map<string, {_id: string, _rev: string}>} localDocMap - 本地文件 id 與 rev 的對應表
 * @returns {Promise<void>}
 */
function deleteLocalDocs(successIds, localDocMap) {
    // 準備批次刪除的清單，加上 _deleted: true 標記
    const docsToDelete = successIds
        .map(id => localDocMap.get(id))
        .filter(doc => doc !== undefined)
        .map(doc => ({ _id: doc._id, _rev: doc._rev, _deleted: true }));

    if (docsToDelete.length === 0) {
        console.log('[deleteLocalDocs] 無需刪除任何本地文件。');
        return Promise.resolve();
    }

    console.log(`[deleteLocalDocs] 準備刪除 ${docsToDelete.length} 筆本地文件: [${docsToDelete.map(d => d._id).join(', ')}]`);

    return db
        .bulkDocs(docsToDelete)
        .then(results => {
            const deleteFails = results.filter(r => !r.ok);
            if (deleteFails.length > 0) {
                console.error(`[deleteLocalDocs] ${deleteFails.length} 筆本地文件刪除失敗:`, JSON.stringify(deleteFails));
            } else {
                console.log(`[deleteLocalDocs] 成功刪除 ${docsToDelete.length} 筆本地文件。`);
            }
        })
        .catch(e => {
            console.error('[deleteLocalDocs] 批次刪除本地文件時發生錯誤:', e);
            throw e;
        });
}

/**
 * resetLocalDb
 * 摧毀並重新初始化整個本地 DB。
 * ⚠️ 此為破壞性操作，僅供緊急手動重置使用，正常流程請使用 deleteLocalDocs()。
 * @returns {Promise<void>}
 */
function resetLocalDb() {
    console.warn('[resetLocalDb] ⚠️ 正在摧毀並重建整個本地 DB...');
    return db
        .destroy()
        .then(function (response) {
            db = new PouchDB(_LOCALDB);
            console.log('[resetLocalDb] 本地 DB 已重新初始化完成。');
            return Promise.resolve();
        })
        .catch(e => {
            console.error('[resetLocalDb] 摧毀本地 DB 失敗:', e);
            return Promise.reject(e);
        });
}

/**
 * updateEmpStats
 * 更新工號使用統計文件 (meta_empStats)。
 * 每次呼叫時，指定工號的 count +1 並更新 lastUsed 時間戳。
 * 統計文件同時寫入本地及遠端 DB。
 * 注意：CouchDB 不允許自訂文件 ID 以底線開頭，故使用 meta_ 而非 _meta_。
 * @param {string} empId - 使用者工號
 * @returns {void}
 */
function updateEmpStats(empId) {
    if (!empId) return;

    console.log(`[updateEmpStats] 更新工號統計: ${empId}`);

    const now = new Date().toISOString();

    /**
     * 執行統計更新的內部函式。
     * 先讀取現有文件，更新後再寫回。
     * @param {PouchDB.Database} targetDb - 要更新的資料庫實例 (本地或遠端)
     * @param {string} dbName - 資料庫名稱，僅用於日誌輸出
     * @returns {Promise<void>}
     */
    function doUpdate(targetDb, dbName) {
        return targetDb.get('meta_empStats')
            .then(doc => {
                if (!doc.stats) doc.stats = {};
                if (!doc.stats[empId]) {
                    doc.stats[empId] = { count: 0, lastUsed: now };
                }
                doc.stats[empId].count++;
                doc.stats[empId].lastUsed = now;
                return targetDb.put(doc);
            })
            .catch(err => {
                if (err.status === 404) {
                    // 文件不存在，建立新的統計文件
                    return targetDb.put({
                        _id: 'meta_empStats',
                        stats: {
                            [empId]: { count: 1, lastUsed: now }
                        }
                    });
                }
                throw err;
            })
            .then(() => console.log(`[updateEmpStats] ${dbName} 統計已更新: ${empId}`))
            .catch(e => console.error(`[updateEmpStats] ${dbName} 統計更新失敗:`, e));
    }

    // 同時更新本地與遠端
    doUpdate(db, '本地');
    doUpdate(rdb, '遠端');
}

// =============================================================================================================

// chrome.action.onClicked.addListener(function(tab) {
//     console.log(tab);
//     //alert("使用者在"+tab.title+ "中點擊了瀏覽器按鈕");
// });

//
// For SPA website
// Hook webNavigaion / webrequest for page re-render detect
// https://medium.com/@softvar/making-chrome-extension-smart-by-supporting-spa-websites-1f76593637e8
/*
chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
    tabId = details.tabId;
    currentUrl = details.url;
    console.log(`tabID: ${tabId} | currentUrl: ${currentUrl}`);
    // 如果 url切換到 "/examManage/CourseExam" ，通知 content-script
    if (currentUrl && currentUrl.indexOf('/examManage/CourseExam') > -1 && tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'eLearning.exam' });
    }
});

chrome.webRequest.onCompleted.addListener(
    function (details) {
        const parsedUrl = new URL(details.url);
        // TODO: filter and check if the desired URL has completed
        //console.log(parsedUrl);
    },
    { urls: ['*://elearning.efoxconn.com/*'] }
);
*/
