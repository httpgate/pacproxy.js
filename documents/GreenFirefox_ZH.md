# 制作FirefoxU盘

libportable是一个开源的工具，可以将原版firefox制作成绿色软件，firefox的所有配置信息都在同一个文件夹里，可以做成U盘随身携带或送人。

* 准备一个U盘，新建文件夹 firefox

* 先下载安装[7zip](https://www.7-zip.org/)

* 再下载海外[中文firefox](https://www.mozilla.org/zh-CN/firefox/all/#product-desktop)到U盘根目录

* 打开7zip软件，在地址栏输入下载的安装文件路径，选择解压其中的"core"文件夹到U盘firefox目录下

* 再下载[libportable](https://sourceforge.net/projects/libportable/files/Tools/portable_bin.7z/download)

* 同样用7zip解压，并将解压后的文件夹里所有文件拷贝到 “core”文件夹内

* 运行"core"文件夹下的"injectpe.bat"文件，按两次回车后，绿色firefox就做好了

* 打开core目录，运行firefox.exe, 在地址栏输入about:support，检查[配置文件夹](firefoxinformation.png)是否在新创建的firefox目录内。如果在就代表制作成功。

* 在U盘根目录创建firefox.bat快捷文件，内容为start “firefox" ./firefox/firefox.exe

* 双击根目录下firefox.bat即可打开firefox, 做好各项设置后备份一下，即可赠送给亲朋好友