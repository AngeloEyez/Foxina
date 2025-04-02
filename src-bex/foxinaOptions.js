import { version } from '../package.json';

// default settings
export const defaultOptions = {
    iedu: {
        autoPlay: true,
        mute: false,
        fillAns: false
    },
    elearning: {
        fillAns: false
    },
    sys: {
        version: version,
        showWhatsNew: 2 // 0不顯示，設定為2則顯示兩次，每顯示一次扣1
    }
};

export async function getOptions() {
    let items = await getAllStorageSyncData(['foxinaOpt']);
    let optstring = items.foxinaOpt;
    let opt = {};

    if (!optstring) {
        // 如果存储中没有 opt 值，创建默认值并写入存储
        let defaultOptionString = JSON.stringify(defaultOptions);
        chrome.storage.local.set({ foxinaOpt: defaultOptionString }, () => {
            console.log('Default opt value created and stored.');
        });
        opt = JSON.parse(defaultOptionString); // make a deep copy
    } else {
        opt = JSON.parse(optstring);
    }

    // 檢查是否有缺失後來新增的項目，有的話用default value補齊
    let saveFlg = false;

    if (!opt.sys) {
        opt.sys = JSON.parse(JSON.stringify(defaultOptions.sys));
        saveFlg = true;
    }

    if (saveFlg) {
        chrome.storage.local.set({ foxinaOpt: JSON.stringify(opt) }, () => {
            console.log('Upgrade option with newly added properties.');
        });
    }
    return opt;
}

export async function setOptions(opt) {
    chrome.storage.local.set({ foxinaOpt: JSON.stringify(opt) }, () => {
        //console.log(`option saved. showWhatsNew:${opt.sys.showWhatsNew}`);
    });
}

// Get local storage
// It can be called like this:
// var obj = await getAllStorageSyncData(['key','key2']);
// obj will have obj.key and obj.key2
//
// https://stackoverflow.com/questions/59440008/how-to-wait-for-asynchronous-chrome-storage-local-get-to-finish-before-continu
function getAllStorageSyncData(top_key) {
    // Immediately return a promise and start asynchronous work
    return new Promise((resolve, reject) => {
        // Asynchronously fetch all data from storage.sync.
        chrome.storage.local.get(top_key, items => {
            // Pass any observed errors down the promise chain.
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            // Pass the data retrieved from storage down the promise chain.
            resolve(items);
        });
    });
}
