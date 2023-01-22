# pacproxy加密代理服务器

[English Readme:](\/documents\/README_EN\.md)
* 普通proxy代理服务器为防止盗用，需要用采用代理密码验证，请求密码时会被识别为代理服务器而被封锁。
* 很多app应用支持操作系统代理设置，但一般不支持访问网络时输入代理服务器密码
* 普通proxy代理服务器没有SSL加密，如果SSL加密的话一般浏览器也不大支持，需要利用pac url让浏览器支持ssl加密的proxy代理。
* pacproxy js利用加密的pac url代替basic auth, 且用https加密流量，达到安全隐身的效果。
* pacproxy js可运行在任何nodejs环境下，适用于各种电脑系统和平板手机。
* pacproxy js支持websocket, 可利用各种开启websocket的CDN, Application Gateway中转流量，或部署到支持nodejs聊天室的服务容器内。

## 推荐

推荐用prcproxy安全的访问以下网站：
* 明慧网：https://www.minghui.org
* 干净世界：https://www.ganjing.com
* 神韵作品: https://shenyunzuopin.com
* 大法经书: https://www.falundafa.org

## 如何使用

请参照 [pac代理电脑手机设置](\/documents\/DeviceSetting_ZH\.md), 并参阅[关于域名](\/documents\/About_Domain_ZH.md)

## 直接运行pacproxy.js，适合各种Cloud平台

### 网站设置

可以直接在代码里编辑pacproxy.js里的[configsInCode](pacproxy\.js)部分，也可以单独保存网站设置文件，参见[示例设置](example.site.domain)

### 运行

node pacproxy.js [网站配置文件] [监听端口号]

如：node pacproxy.js ./example.site.domain/production.cfg 3129

## VPS,网站服务器部署

参见 [pacproxy 网站服务器](https://github.com/httpgate/pacproxy-server)