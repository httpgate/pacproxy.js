# pacproxy PAC加密代理服务器
[English Readme:](\/documents\/README_EN\.md)

* 普通proxy代理服务器为防止盗用，需要用basic auth密码保护，但这就很容易被发现是代理服务器而被封锁。
* 普通proxy代理服务器没有SSL加密，如果SSL加密的话一般浏览器也不大支持，需要利用pac url让浏览器支持ssl加密的proxy代理。
* pacproxy利用加密的pac url代替basic auth密码, 且用https加密流量，达到安全隐身的效果。
* pacproxy在浏览器直接访问它时可以显示其它某个海外网站站点的内容
* pacproxy可运行在任何nodejs环境下。

## 推荐
推荐用prcproxy安全的访问以下网站：
* 明慧网：https://www.minghui.org
* 干净世界：https://www.ganjing.com
* 神韵作品: https://shenyunzuopin.com
* 大法经书: https://www.falundafa.org

## 网站设置
可以直接在代码里编辑pacproxy.js里的[configsInCode](pacproxy\.js)部分，也可以单独保存网站设置文件，参见[示例设置](example.site.domain)

## 运行
node pacproxy.js [网站配置文件] [监听端口号]

如：node pacproxy.js ./example.site.domain/production.cfg 3129
