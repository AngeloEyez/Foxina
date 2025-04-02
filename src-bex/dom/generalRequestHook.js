export default function generalRequestHook(bridge) {
    // Override XMLHttpRequest
    console.log('General Request Hook Enabled.');

    (function (open, send) {
        XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
            //console.log('open:');
            //console.log(arguments);
            this.xhrOpenResuestMethod = arguments[0];
            this.xhrOpenRequestUrl = arguments[1];

            this.addEventListener('load', function () {
                const responseBody = this.responseText;
                //console.log(`responseText: ${responseBody}`);
            });

            open.apply(this, arguments); // reset/reapply original open method
        };

        XMLHttpRequest.prototype.send = function (data) {
            //console.log('send:');
            //console.log(arguments);
            xhrSendRequestData = arguments[0];

            send.apply(this, arguments); // reset/reapply original send method
        };
    })(XMLHttpRequest.prototype.open, XMLHttpRequest.prototype.send);
}
