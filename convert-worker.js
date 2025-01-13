var addresses = [
  "discord.com"
];

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  var url = new URL(request.url);
  var worker = url.searchParams.get('w');
  var config = url.searchParams.get('c');
  var serverIndex = url.searchParams.get('s') || 0;
  var address = addresses[serverIndex % addresses.length];
  var errorMessage = '';

  if (!worker || !config) {
    return renderForm();
  }

  try {
    worker = validateWorkerUrl(worker);
    var protocol = getProtocol(config);
    var modifiedConfig = modifyConfig(config, protocol, worker, address);
    return renderConfig(modifiedConfig);
  } catch (e) {
    return renderError(errorMessage || e.message);
  }
}

function validateWorkerUrl(worker) {
  try {
    return new URL(worker);
  } catch (e) {
    try {
      return new URL("https://" + worker);
    } catch (e) {
      errorMessage = "آدرس ورکر معتبر نمی‌باشد. لطفا آدرس را کامل و همراه با https وارد کنید!";
      throw new Error(errorMessage);
    }
  }
}

function getProtocol(config) {
  if (config.startsWith("vmess://")) return "vmess";
  if (config.startsWith("vless://")) return "vless";
  if (config.startsWith("trojan://")) return "trojan";
  if (config.startsWith("ss://")) return "shadowsocks";
  errorMessage = "پروتکل پیکربندی پشتیبانی نمی‌شود!";
  throw new Error(errorMessage);
}

function modifyConfig(config, protocol, worker, address) {
  switch (protocol) {
    case "vmess":
      return modifyVmessConfig(config, worker, address);
    case "vless":
    case "trojan":
      return modifyVlessTrojanConfig(config, protocol, worker, address);
    case "shadowsocks":
      return modifyShadowsocksConfig(config, worker, address);
    default:
      throw new Error("پروتکل نامعتبر!");
  }
}

function modifyVmessConfig(config, worker, address) {
  try {
    var conf = JSON.parse(atob(config.substr(8)));
    conf.add = address;
    conf.sni = worker.hostname;
    conf.host = worker.hostname;
    conf.path = "/" + conf.add + (conf.path || '');
    if (conf.tls) {
      conf.fp = "random";
      conf.alpn = "h2,http/1.1";
    }
    return "vmess://" + btoa(JSON.stringify(conf));
  } catch (e) {
    errorMessage = "کانفیگ vmess معتبر نمی‌باشد!";
    throw new Error(errorMessage);
  }
}

function modifyVlessTrojanConfig(config, protocol, worker, address) {
  try {
    var conf = {};
    var str = config.substr(protocol === "vless" ? 8 : 9);
    var arr = str.split("@");
    conf.id = arr[0];
    arr = arr[1].split(":");
    conf.address = address;
    var host = arr[0];
    var qs = {};
    try {
      var arrx = arr[1].split("?");
      conf.port = parseInt(arrx[0]);
      arr = arrx[1].split('#');
      qs = parseQuery(arr[0]);
    } catch (e) {
      arr = arr[1].split("#");
      conf.port = parseInt(arr[0]);
    }
    conf.name = arr[1];
    qs.path = "/" + host + (qs.path || '/');
    qs.host = worker.hostname;
    qs.sni = worker.hostname;
    if (qs.tls || qs.security === "tls" || conf.port === 443) {
      if (!(qs.tls || qs.security === "tls")) {
        qs.tls = "tls";
      }
      qs.fp = "random";
      qs.alpn = "h2,http/1.1";
    }
    return protocol + "://" + conf.id + "@" + conf.address + ":" + conf.port + "?" + serializeQuery(qs) + "#" + conf.name;
  } catch (e) {
    errorMessage = "کانفیگ " + protocol + " معتبر نمی‌باشد!";
    throw new Error(errorMessage);
  }
}

function modifyShadowsocksConfig(config, worker, address) {
  try {
    var conf = config.substr(5);
    return "ss://" + conf + "@" + address + ":443";
  } catch (e) {
    errorMessage = "کانفیگ shadowsocks معتبر نمی‌باشد!";
    throw new Error(errorMessage);
  }
}

function renderForm() {
  var html = `<!DOCTYPE html>
  <body dir="rtl" style="font-face: Tahoma; padding: 50px;">
    <h1>بازنویسی کانفیگ‌های (vmess, vless, trojan, shadowsocks) همراه با worker</h1>
    <form method="GET">
      <p>
        <label>آدرس worker خود را وارد کنید:<br/>
          <input name="w" dir="ltr" autofocus="true" style="width: 50%; min-width: 400px;"/>
        </label>
      </p>
      <p>&nbsp;</p>
      <p>
        <label>کانفیگ خود را وارد کنید:<br/>
          <textarea name="c" dir="ltr" rows="10" style="width: 50%; min-width: 400px;"></textarea>
        </label>
      </p>
      <p>&nbsp;</p>
      <p>
        <label>سرور مورد نظر را انتخاب کنید:<br/>
          <select name="s" style="width: 50%; min-width: 400px;">
            ${addresses.map((addr, index) => `<option value="${index}">${addr}</option>`).join('')}
          </select>
        </label>
      </p>
      <p>&nbsp;</p>
      <p>
        <button name="start"><strong>تبدیل کن</strong></button>
      </p>
    </form>
  </body>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}

function renderConfig(config) {
  var html = `<!DOCTYPE html>
  <body dir="rtl" style="font-face: Tahoma; padding: 50px;">
    <h1>این کانفیگ را کپی کرده و در برنامه‌ی v2ray خودتون اضافه کنید:</h1>
    <p>&nbsp;</p>
    <textarea dir="ltr" rows="10" style="width: 50%; min-width: 400px;">${config}</textarea>
  </body>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}

function renderError(message) {
  var html = `<div dir="rtl">${message}</div>`;
  return new Response(html, {
    status: 400,
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}

function parseQuery(queryString) {
  var query = {};
  var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  }
  return query;
}

function serializeQuery(obj) {
  var str = [];
  for (var p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  return str.join("&");
}