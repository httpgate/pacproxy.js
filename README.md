# pacproxy加密代理服务器

[English Readme:](\/documents\/README_EN\.md)
* 普通proxy代理服务器为防止盗用，需要用采用代理密码验证，请求密码时会被识别为代理服务器而被封锁。
* pacproxy利用加密的pac url代替basic auth, 且用https加密流量，达到安全隐身的效果。
* pacproxy[支持websocket](https://github.com/httpgate/wssproxy-agent), 可利用各种开启websocket的CDN, Application Gateway中转流量。
* pacproxy可以部署到支持nodejs聊天室的服务容器内，可以在Nginx,Litespeed Web Server内部署，此时就仅支持websocket代理
* 阻止通过代理访问内网的常见IP段：192.168.xx, 10.xxx, 127.xxx, 169.254.xx 以及常见内网ipv6地址


## 推荐

推荐用prcproxy安全的访问以下网站：
* 明慧网：https://www.minghui.org
* 干净世界：https://www.ganjing.com
* 神韵作品: https://shenyunzuopin.com
* 大法经书: https://www.falundafa.org


## 如何使用

* 运行pacproxy服务后，屏幕会显示 pacurl 和 wssurl

* 用pacurl翻墙请参照 [pac代理电脑手机设置](\/documents\/DeviceSetting_ZH\.md)

* 用wssurl翻墙请参照 [wssagent代理软件](https://github.com/httpgate/wssproxy-agent)

* 搭建pacproxy服务器需要[申请一个域名](\/documents\/About_Domain_ZH.md)


## 直接部署

### 设置

可以直接在代码里编辑pacproxy.js里的[configsInCode](pacproxy\.js)部分，也可以单独保存网站设置文件，参见[示例设置](example.site.domain)

### 运行

node pacproxy.js [网站配置文件] [监听端口号]

如：node pacproxy.js ./example.site.domain/production.cfg 3129


## VPS服务器部署

参见 [pacproxy服务器](https://github.com/httpgate/pacproxy-server)


## 手机部署

参见 [pacproxy迷你服务器](https://github.com/httpgate/pacproxy-miniserver)


## 作者的话

有这么一群人

他在沉默中活着

也在沉默中死去

他沉默的看着这个世界

无数个喇叭不厌其烦的教他如何做忠臣孝子

他被剥夺了思想的权力

一切都被给予了答案

他从来不敢表达自己的喜怒哀乐

彷佛这个世界没人关心一样

他是我的父亲

他是我的兄弟

他们看着我们长大

我们看着他们老去

如果你能翻墙

请也帮助他们翻墙

如果你能呐喊

请也帮助他们呐喊

如果你看见过自由

请告诉他们他的模样

别忘了告诉他们

We love you

We are suffering with you

谨以此软件献给

我中国的父老乡亲们