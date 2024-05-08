# pacproxy加密代理服务器

[English Readme:](\/documents\/README_EN\.md)
* 普通proxy代理服务器有明显的特征，容易被识别和封锁。pacproxy可伪装成普通网站，难于识别和封锁。
* 普通代理服务会泄露访问的网站和http内容，pacproxy使用https加密流量，达到安全隐身的效果。
* pacproxy更安全，比vpn速度快占用资源少，很适合在配置低的设备上运行。
* pacproxy[支持websocket](https://github.com/httpgate/wssproxy-agent), 可利用各种开启websocket的CDN中转流量,支持cloudflare, cloudfront等。
* pacproxy可以部署到支持nodejs聊天室的服务容器内，可以在Nginx,Litespeed Web Server内部署，此时就仅支持websocket代理
* 阻止通过代理访问内网的常见IP段：192.168.xx, 10.xxx等，以及常见内网ipv6地址，可安全的部署在家里或公司的电脑上。


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


## VPS服务器部署

参见 [pacproxy服务器](https://github.com/httpgate/pacproxy-server)


## 直接部署

### 设置

可以直接在代码里编辑pacproxy.js里的[configsInCode](pacproxy\.js)部分，也可以单独保存网站设置文件，参见[示例设置](example.site.domain)

### 运行

node pacproxy.js [网站配置文件] [监听端口号]

如：node pacproxy.js ./example.site.domain/production.cfg 3129

其中[网站配置文件] [监听端口号] 均为可选参数


### 后台运行

推荐用pm2：

pm2 start default.config.js

也可以用nohup:

nohup ./pacproxy.js ./example.site.domain/production.cfg &


## 手机部署

参见 [pacproxy迷你服务器](https://github.com/httpgate/pacproxy-miniserver)

