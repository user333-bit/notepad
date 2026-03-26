部署教程：
必做：1.打开dash.cloudflare.com
2.登录你的帐号
3.打开Compute-Workers and Pages
4.点右上角的创建应用程序-从 Hello World! 开始
5.Worker name填notepad，然后点部署
6.点右上角的编辑代码
7.将左侧代码全部替换为notepad code.js里的代码，并点右上角的部署
8.打开存储和数据库-Workers KV
9.点右上角Create Instance，命名空间名称填NOTES_KV
10.回到Compute-Workers and Pages-notepad，点绑定，点添加绑定，点KV 命名空间，点添加绑定，变量名称填NOTES_KV，KV 命名空间选刚才创建的NOTES_KV，然后点添加绑定
11.点设置，找到变量和机密，点右边的添加：变量名称填PASSWORD 值填你想要的密码，然后点右下角部署
选做：在设置里找到域和路由，点右边的添加：点自定义域，框里输入你的域名或子域名，然后点右下角添加域
