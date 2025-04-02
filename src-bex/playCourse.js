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
var initTimerId, wtgTimerId;

// 读取設定
let opt = {};
chrome.storage.onChanged.addListener(function (changes, namespace) {
    if ('foxinaOpt' in changes) {
        var storageChange = changes['foxinaOpt'];
        opt = JSON.parse(storageChange.newValue);
        console.log('New value for foxinaOpt:', opt);
    }
});

chrome.storage.local.get('foxinaOpt', items => {
    opt = JSON.parse(items.foxinaOpt);
});

// 設定監聽內容變化
var MutationObserver = window.MutationObserver;

DocumentObserverConfig = {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true
};

PlayObserver = new MutationObserver(async function (mutationsList, observer) {
    // 如果影片暫停
    if (document.getElementsByClassName('vjs-play-control vjs-button')[0].innerText == 'Play') {
        console.log(`Pause Detected (MutationObserver). Starting a video.`);
        await delay(1000);
        PlayNext();
    }

    //信息視窗
    //console.log(document.getElementsByClassName('layui-layer-content'));
    if (document.getElementsByClassName('layui-layer-content')[0].innerText == '您操作的太频繁了，请休息一下') {
        console.log('討厭視窗退散!');
        document.getElementsByClassName('layui-layer-btn0')[0].click();
    }
});

// 剛開始等待網頁 video interface ready 後再
initTimerId = setInterval(function () {
    // count = ID值
    console.log(`Check if video interface Ready.`);
    let playbtn = document.getElementsByClassName('vjs-play-control vjs-button')[0];
    if (!playbtn) {
        // 若沒有撥放按鈕, 則找一個影片開始撥放
        console.log('No playbtn, try to start a video.');
        PlayNext();
    } else {
        console.log('Video interface ready - playbtn found.');
        PlayObserver.observe(playbtn, DocumentObserverConfig);
        console.log('MutationObserver added. Clear initial timer.');
        clearInterval(initTimerId);
    }
}, 2000);

// Watch Dog Timer - 5秒 check 一次是否還再撥放
let playtimeL = '';
try {
    playtimeL = document.getElementsByClassName('vjs-remaining-time-display')[0].innerText;
} catch {}
wtgTimerId = setInterval(function () {
    let pt = document.getElementsByClassName('vjs-remaining-time-display')[0].innerText;
    if (pt == playtimeL) {
        // 沒撥放
        console.log('Pause detected (WTG). Starting a video.');
        PlayNext();
    } else {
        playtimeL = pt;
        mute();
    }

    // 檢查是否還在撥放 已完成 項目
    if ($('dd.active').text().includes('已完成')) {
        PlayNext();
    }

    if ($('a.layui-layer-btn0').text()) {
        $('a.layui-layer-btn0').click();
    }
}, 5000);

delay(1000).then(() => PlayNext());

//
// 播放下一首
//
function PlayNext() {
    if (!opt.iedu.autoPlay) {
        console.log('iedu autoPlay disabled. ', opt.iedu.autoPlay);
        return;
    }
    let allDone = true;
    $('div[id^=playtime]').each(function (id, val) {
        if ($(this).text().includes(':') || $(this).text().includes('%') || $(this).text().includes('頁') || $(this).text().includes('页')) {
            // 還有可以撥放的 時間
            console.log(
                `播放 : ${$(this)
                    .parent()
                    .text()
                    .replace(/\r\n|\n/g, '')
                    .replace(/\s/g, '')}`
            );
            if ($('div[style="display: block;"]').find('img.pdflogo').length > 0) {
                console.log('PDF:click');
                $('div[style="display: block;"]').find('img.pdflogo').click();
            } else {
                console.log('VIDEO:click');
                $(this).parent()[0].click();
            }
            $(this).parent().addClass('active');
            delay(1000).then(() => mute());

            allDone = false;
            return false; // 等於break each 迴圈, continue 用 return;
        } else {
            $(this).parent().removeClass('active');
        }
    });

    if (allDone) {
        console.log('All Done, stop initTimer and wtgTimer.');
        clearInterval(initTimerId);
        clearInterval(wtgTimerId);
    }
}

function mute() {
    if (opt.iedu.mute && opt.iedu.autoPlay) {
        if ($('button[title="Mute"]').text() == 'Mute') {
            console.log('click Mute');
            $('button[title="Mute"]')[0].click();
        }
    } else {
        if ($('button[title="Unmute"]').text() == 'Unmute') {
            console.log('click Unmute');
            $('button[title="Unmute"]')[0].click();
        }
    }
}

// Delay n miliseconds
function delay(n) {
    return new Promise(function (resolve) {
        setTimeout(resolve, n);
    });
}
