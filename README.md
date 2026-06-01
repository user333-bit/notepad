📓 网页笔记本：

一个基于 Cloudflare Workers 和 KV 构建的、轻量且极其流畅的现代化个人网页笔记本。
支持密码访问、响应式 iOS 风格 UI、笔记置顶、全局快速搜索以及富文本链接插入等功能。

## ✨ 功能特性

* **🔒 私密访问**：内置安全登录拦截，支持会话过期与主动登出，安全守护个人隐私。
* **📌 置顶功能**：重要笔记一键置顶（★），不再迷失在长列表中。
* **🔍 实时搜索**：支持标题与内容的全局关键词秒级过滤。
* **↕️ 灵活排序**：支持“最新优先（倒序）”与“最早优先（正序）”自由切换。
* **🔗 智能链接**：可在标题或内容中一键精准插入超链接。
* **📱 极简高密度布局**：无凌乱的块状堆叠，完美适配手机端与 PC 端。

### 🛠️ 部署指南：

**必做：**
1. 打开 `dash.cloudflare.com`
2. 登录你的帐号
3. 打开 `计算` - `Workers and Pages`
4. 点右上角的 **创建应用程序** - **从 Hello World! 开始**
5. `Worker name` 填 `notepad`，然后点 **部署**
6. 点右上角的 **编辑代码**
7. 将左侧代码全部替换为 `notepad code.js` 里的代码，并点右上角的 **部署**
8. 打开 **存储和数据库** - `Workers KV`
9. 点右上角 **Create Instance**，命名空间名称填 `NOTES_KV`，点`创建`
10. 回到 `计算` - `Workers and Pages` - `notepad`，点 **绑定**，点 **添加绑定**，点 **KV 命名空间**，点 **添加绑定**，变量名称填 `NOTES_KV`，KV命名空间选刚才创建的 `NOTES_KV`，点 **添加绑定**
11. 点 **设置**，找到 **变量和机密**，点右边的 **添加**：变量名称填 `PASSWORD`，值填你想要的密码，然后点右下角 **部署**

**选做：**

* 点 **域**，点 **添加域名**：点你想要当notepad的域名，框里输入你想要的子域名（只输前缀）或不输，然后点右下角 **添加域名**

🎉 **大功告成！** 现在访问你的Worker域名，输入密码即可开始使用你的私密笔记本！


**成品展示：**🫡
<img width="1440" height="775" alt="image" src="https://github.com/user-attachments/assets/a1825624-2d10-432e-8e21-f32e7c7084c8" />
<img width="1440" height="774" alt="image" src="https://github.com/user-attachments/assets/f8618767-9337-4da8-94c1-6a10a3d16ac3" />
<img width="1440" height="773" alt="image" src="https://github.com/user-attachments/assets/b38827c8-f6ad-4707-808a-96dfa77fa7a2" />
<img width="1440" height="774" alt="image" src="https://github.com/user-attachments/assets/7d16292a-d028-4e67-a09c-e7572db1aa08" />
<img width="1440" height="777" alt="image" src="https://github.com/user-attachments/assets/c38c15aa-1ad4-4e98-b33a-b437a7c19454" />
<img width="1440" height="776" alt="image" src="https://github.com/user-attachments/assets/0c92e7ef-cd1d-45de-a4ec-8c6921c50f68" />
<img width="1440" height="774" alt="image" src="https://github.com/user-attachments/assets/c2dee74b-653d-442b-a689-cf6b9938f808" />
<img width="1440" height="774" alt="image" src="https://github.com/user-attachments/assets/ad63e1c7-72c5-4cd5-bc7f-0f5462f4a4f2" />
<img width="1440" height="777" alt="image" src="https://github.com/user-attachments/assets/a6d5a9f1-3f90-4e7b-9da3-a0f1027fc8b2" />
<img width="1440" height="775" alt="image" src="https://github.com/user-attachments/assets/1906fcf0-ab49-4faf-b112-3d40eb47c335" />
<img width="1440" height="776" alt="image" src="https://github.com/user-attachments/assets/60f9fbf9-389f-4290-a7ed-02f9f615e17e" />
更多功能请大家自己部署后查看！
