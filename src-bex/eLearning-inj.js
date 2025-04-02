var CryptoJS = require('crypto-js');

// Adding UI ...
/*
function init() {
    const el = document.createElement('input');
    el.setAttribute('type', 'checkbox');
    document.body.appendChild(el);
    el.addEventListener('click', event => {
        console.log(event.target.checked);
    });
    console.log('Start injection script... Done.');
}
init();
*/

const exam = {
    key: 'tokenaes12345678',
    question: []
};

// Override XMLHttpRequest
// 為了能抓住所有的request, 在 manifest.json設定 "run_at": "document_start"
// 讓此script在所有內容之前執行
(function (open, send) {
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        //console.log(`open: ${this.xhrOpenRequestUrl}`);
        this.xhrOpenResuestMethod = arguments[0];
        this.xhrOpenRequestUrl = arguments[1];

        this.addEventListener('load', function () {
            const responseBody = this.responseText;

            // 如果url是讀取考試卷，攔截並解碼
            if (this.xhrOpenResuestMethod == 'GET' && this.xhrOpenRequestUrl.includes('getExamPaperQuestion')) {
                decodeData(responseBody); // 取得考題、答案
                window.postMessage({ type: 'FROM_PAGE', exam }); // 將答案送回 content-script 填寫
            }
        });

        open.apply(this, arguments); // reset/reapply original open method
    };

    XMLHttpRequest.prototype.send = function (data) {
        //console.log('send:');
        //console.log(arguments);
        xhrSendRequestData = arguments[0];

        if (this.xhrOpenResuestMethod == 'POST' && this.xhrOpenRequestUrl.includes('examRecordGrade')) {
            //arguments[0] = modifyGrade(arguments[0]);
        }

        send.apply(this, arguments); // reset/reapply original send method
    };
})(XMLHttpRequest.prototype.open, XMLHttpRequest.prototype.send);

function decodeData(resText) {
    let res = JSON.parse(resText);

    if (res.code === '200') {
        if (res.data.split('store').length > 1 && res.data.split('store')[1].split('_').length > 1) {
            exam.question = JSON.parse(decrypt(res.data.split('store')[2], exam.key));
        } else {
            exam.question = JSON.parse(decrypt(res.data, exam.key));
        }
        //console.log(exam);
    } else {
        console.log(res.data.msg);
    }
}

function modifyGrade(postData) {
    var pst = JSON.parse(postData);
    let userGrade = JSON.parse(decrypt(pst.userGrade, exam.key));
    userGrade.grade = '100.00';
    userGrade = encrypt(JSON.stringify(userGrade), exam.key);
    return JSON.stringify({ userGrade: userGrade });
}

// grabbed from AES.js
//加密
function encrypt(word, keyStr) {
    var key = CryptoJS.enc.Utf8.parse(keyStr);
    var srcs = CryptoJS.enc.Utf8.parse(word);
    var encrypted = CryptoJS.AES.encrypt(srcs, key, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
    return encrypted.toString();
}
//解密
function decrypt(word, keyStr) {
    var key = CryptoJS.enc.Utf8.parse(keyStr);
    var decrypt = CryptoJS.AES.decrypt(word, key, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
    return CryptoJS.enc.Utf8.stringify(decrypt).toString();
}
