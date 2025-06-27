# pacproxy翻墙上网设置
需要先运行[pacproxy服务](https://github.com/httpgate/pacproxy.js) ， 运行后屏幕会显示 PACURL


## Windows，桌面电脑，Android手机用Firefox：

* Windows下载[海外firefox浏览器](https://www.mozilla.org/en-US/firefox/new/), Firefox->菜单：设置(Settings)->搜索：网络(Network)->自动代理服务器设置URL(Automatic proxy configuration URL) 输入：https://PACURL, 搜索DOH 选(Enable DNS over HTTPS)启用加密DNS.

* Android要安装[firefox nightly build](https://play.google.com/store/apps/details?id=org.mozilla.fenix )（可[下载apk自己安装](https://www.apkmirror.com/apk/mozilla/firefox-fenix))， 在Firefox地址栏中输入about:config，在出现的搜索框中，搜索network.proxy.type更改为2，找到network.proxy.autoconfig_url更改为 https://PACURL. 找到network.trr.mode改为2。 network.proxy.allow_bypass设置为 false 。

* IPAD/IPhone上的firefox是Safari内核，不能单独设置代理。苹果MAC电脑则可以用firefox没有问题

* 如果提示输入代理用户名/密码，需要2分钟内输入正确用户名密码，否则需要重新打开浏览器

* 为避免连不上代理时浏览敏感网站流量走本地网络，桌面版firefox也需要在地址栏中输入about:config，搜索并设置network.proxy.allow_bypass 为 false

* 中文版firefox需要将默认搜索引擎从百度改为Google。

* 可制作windows[绿色版firefox](GreenFirefox_ZH.md)，保存在U盘里，按上述方法设置好后，分享给亲朋好友


## 注意事项

* 设置完后先访问www.google.com或ifconfig.me等非敏感被封网站测试是否能正常翻墙，确认能翻墙后才访问敏感站点。访问国内网站请不要用翻墙代理.

* 隔几个小时不访问网络后，代理服务会自动断开，再上网时会连不上。这时只需要关闭浏览器再重新打开就可以了。有些app关闭后仍然会后台运行，需要在任务管理器关闭进程。

* 被长期监控的敏感人士，最好用一台干净设备蹭咖啡厅，快餐店的wifi，在人多时段上网。避免在家里连接代理。可考虑用[wssagent](https://github.com/httpgate/wssproxy-agent)通过cloudflare等CDN中转翻墙

* 上敏感网站需要用浏览器的匿名模式，尽量访问https:// 的加密网站

* 服务器IP如果封锁了也可随时更换，所以IP被封短时上不了网不要紧，通知服务器管理人员更换IP，先保存当前域名和PAC链接.
 

## 手机全局代理，仅限国外品牌的原装手机/平板：

* Android安卓系统，长按wifi连接，双击家里的wifi名，点屏幕右上角编辑图标，选(Advanced Setting)高级设置->代理(Proxy)->选自动设置(Auto-config)->输入PAC网络地址(PAC Web Address)： https://PACURL ->点(Save)保存,  如果仅firefox翻墙, 则输入: https://PACURL/firefox (不适用于firefox Nightly版本)

* 主流浏览器都支持pacproxy。很多非浏览器app不支持pacproxy的https加密协议，推荐用[wssgent](https://github.com/httpgate/wssproxy-agent/tree/main/example)将pacproxy转换成普通代理

* 苹果手机平板, 由于ios Safari不支持https加密代理，其他浏览器在ios上必须用Safari内核，所以暂不支持pacproxy

* 设置全局pacproxy的话，其他软件就也能上网，设备上尽量不要安装任何国产软件


## Windows全局代理，仅限干净原装WINDOWS专用系统：

* WINDOWS 10/11, 开始菜单->设置(Settings)->搜索：代理(Proxy)->勾选上(Use Setup Script)使用设置脚本->输入(Script Address)脚本地址：https://PACURL->点(Save)保存， 如果仅firefox翻墙, 则输入: https://PACURL/firefox

* 如要支持一些非浏览器软件，推荐用[wssgent](https://github.com/httpgate/wssproxy-agent)将pacproxy转换成普通代理。 wssagent支持Windows/Linux/MacOS.


## 其他设备

* 可使用U盘安装u盘启动的chromeos系统或linux系统，设置方式类似。U盘推荐用SAMSUNG FIT PLUS

* 在虚拟主机里安装Linux或Windows都可以安装Firefox上网

* 干净的专用系统，可以在Firefox设置不走代理(No Proxy), wifi上设置PAC代理，这样其它软件和浏览器都走PAC代理
