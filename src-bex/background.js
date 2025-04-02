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

pushDB();

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.action) {
        case 'getCourse': {
            console.log(`[getCourse]Getting doc from db: ${request.title}`);
            rdb.get(request.title)
                .then(function (doc) {
                    //console.log(doc);
                    sendResponse(doc);
                })
                .catch(function (err) {
                    console.log(err);
                    console.log(`[getCourse]Remote db down or 404, query local db ...`);
                    db.get(request.title)
                        .then(function (doc) {
                            //console.log(doc);
                            sendResponse(doc);
                        })
                        .catch(e => {
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
                                sendResponse({ msg: `本地更新 ${cnt} 個資料成功: ${doc._id}` });
                            })
                            .catch(err => {
                                console.log(`本地更新 ${cnt} 個資料失敗: ${doc._id}`);
                                console.log(err);
                                sendResponse({ msg: `本地更新 ${cnt} 個資料失敗: ${doc._id}`, err: err });
                            });
                    } else {
                        console.log('本地資料不須更新');
                        sendResponse({ msg: `本地資料不須更新: ${doc._id}` });
                    }
                })
                .catch(function (err) {
                    //console.log("=====================")
                    //console.log(err);
                    if (err.status == 404) {
                        console.log('本地未找到課程, 準備新增...');

                        db.put(upd)
                            .then(res => {
                                console.log(`本地課程新增成功: ${upd._id}`);
                                if (upd.Q != undefined) {
                                    pushDB();
                                }
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

        default: {
            //var key = await getKey();
            break;
        }
    }

    return true;
});

function syncdb() {
    console.log(`Start sync...`);
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
        })
        .on('complete', function (info) {
            console.log('Start sync... completed.');
            //console.log(info);
        })
        .on('error', function (err) {
            console.log("Start sync... error or can't connect!");
            console.log(err);
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

    return cnt;
}

//
// PushDB
// Push local DB to remote and clear local data
//
function pushDB() {
    db.allDocs({ include_docs: true })
        .then(function (res) {
            // Collect _id array from local db.
            let keys = [];
            res.rows.forEach(r => {
                keys.push(r.doc._id);
            });
            if (keys.length == 0) {
                return;
            } // Local db is empty.
            //console.log(keys);

            // bulck get remote db data by collected _id array.
            rdb.allDocs({ include_docs: true, keys: keys })
                .then(rres => {
                    let mDocs = []; // new docs array to be pushed to remote db.

                    // Merge docs
                    res.rows.forEach((r, i) => {
                        let rdoc = rres.rows[i].doc;
                        if (rdoc == undefined) {
                            rdoc = {};
                        }
                        let cnt = mergeDoc(rdoc, r.doc);
                        if (cnt > 0) {
                            mDocs.push(rdoc);
                            console.log(`[pushDB 遠端更新] ${rdoc._id} : ${cnt}`);
                        }
                    });

                    // Update mDocs to remote db and clean up local db.
                    if (mDocs.length > 0) {
                        console.log(mDocs);
                        rdb.bulkDocs(mDocs)
                            .then(r => {
                                console.log('[pushDB():rdb.bulkDocs] Update remote db successfully.');
                                resetLocalDb();
                            })
                            .catch(e => {
                                console.log('[pushDB():rdb.bulkDocs] Update remote db error!');
                                console.log(e);
                            });
                    } else {
                        resetLocalDb();
                    }
                })
                .catch(err => {
                    console.log(err);
                });
        })
        .catch(function (err) {
            console.log(err);
        });
}

//
// resetLocalDB
// Destroy and re-initialize local db
//
function resetLocalDb() {
    db.destroy()
        .then(function (response) {
            db = new PouchDB(_LOCALDB);
            console.log('[resetLocalDb()] Local db re-initialized.');
        })
        .catch(e => {
            console.log('[resetLocalDb()] Delete local db FAIL:');
            console.log(e);
        });
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
