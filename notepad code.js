export default {
  async fetch(request, env, ctx) {
    const PASSWORD = env.PASSWORD;
    const NOTES_KV = env.NOTES_KV;
    const url = new URL(request.url);
    const method = request.method;
    const cookie = request.headers.get("Cookie") || "";
    const isLogged = cookie.includes("authorized=true");

    if (url.pathname === "/logout") {
      return new Response("退出中...", {
        status: 302,
        headers: { "Location": "/", "Set-Cookie": "authorized=; Path=/; HttpOnly; Max-Age=0" },
      });
    }

    if (method === "POST" && url.pathname === "/login") {
      const formData = await request.formData();
      if (formData.get("password") === PASSWORD) {
        return new Response("OK", {
          status: 302,
          headers: { "Location": "/", "Set-Cookie": "authorized=true; Path=/; HttpOnly; Max-Age=86400" },
        });
      }
      // 这里理论上不会被触及，因为前端 JS 会拦截，但为了安全保留
      return new Response("密码错误", { status: 403 });
    }

    if (!isLogged) {
      // 传入正确密码给前端做校验，避免跳转
      return new Response(renderLoginPage(PASSWORD), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }

    // API: 保存
    if (method === "POST" && url.pathname === "/api/save") {
      const { notes } = await request.json();
      await NOTES_KV.put("structured_notes", JSON.stringify(notes));
      return new Response(JSON.stringify({ success: true }));
    }

    const rawData = await NOTES_KV.get("structured_notes") || "[]";
    
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: -apple-system, sans-serif; background: #f5f5f7; color: #333; }
          .header { background: #fff; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; position: sticky; top: 0; z-index: 100; }
          .editor-box { background: #fff; padding: 20px; border-bottom: 1px solid #eee; margin-bottom: 10px; }
          input, textarea { width: 100%; border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-bottom: 10px; font-size: 16px; outline: none; display: block; }
          textarea { height: 80px; resize: none; }
          .add-btn { width: 100%; background: #007bff; color: #fff; border: none; padding: 12px; border-radius: 6px; font-weight: bold; font-size: 16px; }
          .note-item { background: #fff; margin-bottom: 2px; overflow: hidden; }
          .note-header { padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; }
          .note-header:active { background: #f0f0f0; }
          .note-title { font-weight: 500; font-size: 16px; flex: 1; }
          .note-arrow { color: #ccc; font-size: 12px; margin: 0 10px; }
          .note-content { display: none; padding: 15px 20px; background: #fafafa; border-top: 1px solid #f0f0f0; color: #666; white-space: pre-wrap; line-height: 1.6; border-bottom: 1px solid #eee; }
          .note-item.active .note-content { display: block; }
          .note-item.active .note-arrow { transform: rotate(90deg); }
          .del-btn { color: #ff4d4f; font-size: 14px; padding: 5px; cursor: pointer; }
          #status { text-align: center; font-size: 12px; color: #999; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin:0; font-size:1.1rem;">🗂️ 分类记事本</h2>
          <a href="/logout" style="text-decoration:none; color:#999; font-size:13px;">退出</a>
        </div>
        <div class="editor-box">
          <input type="text" id="title" placeholder="笔记标题...">
          <textarea id="content" placeholder="点击展开后显示的内容..."></textarea>
          <button class="add-btn" onclick="addNote()">保存新笔记</button>
          <div id="status"></div>
        </div>
        <div id="list"></div>
        <script>
          let notes = ${rawData};
          function render() {
            const listEl = document.getElementById('list');
            listEl.innerHTML = notes.map((item, index) => \`
              <div class="note-item" id="item-\${index}">
                <div class="note-header" onclick="toggle(\${index})">
                  <span class="note-arrow">▶</span>
                  <span class="note-title">\${item.title}</span>
                  <span class="del-btn" onclick="event.stopPropagation(); deleteNote(\${index})">删除</span>
                </div>
                <div class="note-content">\${item.content}</div>
              </div>
            \`).reverse().join('');
          }
          function toggle(index) { document.getElementById('item-'+index).classList.toggle('active'); }
          async function sync() {
            const status = document.getElementById('status');
            status.innerText = "同步中...";
            await fetch('/api/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notes })
            });
            status.innerText = "已保存";
          }
          function addNote() {
            const t = document.getElementById('title');
            const c = document.getElementById('content');
            if(!t.value.trim()) return alert('请输入标题');
            notes.push({ title: t.value, content: c.value });
            t.value = ''; c.value = '';
            render();
            sync();
          }
          function deleteNote(index) {
            if(confirm('删除此条？')) {
              notes.splice(index, 1);
              render();
              sync();
            }
          }
          render();
        </script>
      </body>
      </html>
      `,
      { headers: { "Content-Type": "text/html;charset=UTF-8" } }
    );
  },
};

function renderLoginPage(correctPassword) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f7; }
      .card { background: white; padding: 30px; border-radius: 12px; width: 85%; max-width: 350px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      input { width: 100%; padding: 12px; margin: 15px 0 5px 0; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box; }
      button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold; margin-top: 10px; }
      #err { color: #ff4d4f; font-size: 14px; height: 20px; margin-bottom: 5px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h3 style="margin:0">私密空间</h3>
      <div id="err"></div>
      <form id="loginForm" action="/login" method="POST" onsubmit="return check(event)">
        <input type="password" id="pw" name="password" placeholder="请输入密码" required autofocus>
        <button type="submit">确认进入</button>
      </form>
    </div>
    <script>
      function check(e) {
        const input = document.getElementById('pw');
        const err = document.getElementById('err');
        // 前端直接比对，不对就不让 form 提交，也不跳转
        if (input.value !== "${correctPassword}") {
          e.preventDefault(); 
          err.innerText = "密码错误！";
          input.value = "";
          return false;
        }
        return true;
      }
    </script>
  </body>
  </html>
  `;
}