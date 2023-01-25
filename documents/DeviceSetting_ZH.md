# pacproxy翻墙上网设置

## Windows电脑，Android手机用Firefox：

* Windows下firefox浏览器, Firefox->菜单：设置(Settings)->搜索：网络(Network)->(Automatic proxy configuration URL)自动代理服务器设置链接->输入：https://PACURL ->选(Enable DNS over HTTPS)启用加密DNS->点(OK)确认.

* Android要安装firefox [nightly build](https://play.google.com/store/apps/details?id=org.mozilla.fenix )（[可下载apk自己安装](https://www.apkmirror.com/apk/mozilla/firefox-fenix)， 在Firefox地址栏中输入about:config，在出现的搜索框中，键入proxy点搜索按钮。从下面列出的相关选项中，找到network.proxy.type更改为2，找到network.proxy.autoconfig_url更改为 https://PACURL .  再搜索栏键入trr, 从列出选项中找到network.trr.mode改为2，network.trr.odoh.enabled改为true，network.trr.uri更改为https://mozilla.cloudflare-dns.com/dns-query 。感兴趣的可以在windows下的firefox做设置后看相关的选项数值是多少.

* IPAD/IPhone虽然也能装firefox, 但据说是Safari内核，不能单独设置代理。苹果电脑则可以用firefox没有问题

## 如果海外设备不用Firefox的加密DNS, 则需要装DNS加密软件：

* 目前建议安装Cloudflare的[One DNS](https://1.1.1.1/), 加密DNS主要是为了隐藏服务器IP，域名本身很难封锁

* 服务器IP如果封锁了也可随时更换，所以IP被封短时上不了网不要紧，通知服务器管理人员更换IP，先保存当前域名和PAC链接

* 海外设备在wireless无线网络上设置pacproxy的话，其他软件就也能上网，但设备上就不能装任何国产软件

## 仅限国外购买的国外品牌的原装手机/平板：

* 苹果手机平板，设置Settings->Wi-Fi ->点击家里的wifi名 -> 滚动到最下边有http代理(http proxy)->选自动(Auto)->输入(URL)网址：https://PACURL

* Android安卓系统，长按wifi连接，双击家里的wifi名，点屏幕右上角编辑图标，选(Advanced Setting)高级设置->代理(Proxy)->选自动设置(Auto-config)->输入PAC网络地址(PAC Web Address)： https://PACURL->点(Save)保存

## 仅限没安装国产软件的干净原装WINDOWS专用系统：

* WINDOWS 10/11, 开始菜单->设置(Settings)->搜索：代理(Proxy)->勾选上(Use Setup Script)使用设置脚本->输入(Script Address)脚本地址：https://PACURL->点(Save)保存

## 其他设备

* 推荐使用U盘安装u盘启动的chromeos系统或linux系统，设置方式类似。U盘推荐用SAMSUNG FIT PLUS

* 在虚拟主机里安装Linux或Windows都可以安装Firefox上网


## 注意事项

* 设置完后先访问www.google.com或其它非敏感被封网站测试是否能正常翻墙，确认能翻墙后才访问敏感站点。访问国内网站请不要用翻墙代理.

* 隔一段时间不访问网站后，代理服务会自动断开，再上网时会连不上。这时只需要关闭浏览器再重新打开，或断开wifi再连上就可以了。

* 被长期监控的敏感人士，最好用一台干净设备蹭咖啡厅，快餐店的wifi，在人多时段上网。避免在家里连接代理。

* 某些时段翻墙上网人多可能速度很慢， 可以选个别的时间翻墙上网看看。