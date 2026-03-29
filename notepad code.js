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
      return new Response("密码错误", { status: 403 });
    }

    if (!isLogged) {
      return new Response(renderLoginPage(PASSWORD), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }

    if (method === "POST" && url.pathname === "/api/save") {
      const { notes, settings } = await request.json();
      if (notes) await NOTES_KV.put("structured_notes", JSON.stringify(notes));
      if (settings) await NOTES_KV.put("app_settings", JSON.stringify(settings));
      return new Response(JSON.stringify({ success: true }));
    }

    const rawData = await NOTES_KV.get("structured_notes") || "[]";
    const rawSettings = await NOTES_KV.get("app_settings") || '{"isDesc": true}';
    
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
        <title>网页笔记本</title>
        <style>
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          body { margin: 0; font-family: -apple-system, sans-serif; background: #f5f5f7; color: #1d1d1f; }
          .header { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100; }
          .editor-box { background: #fff; padding: 20px; border-bottom: 1px solid #eee; }
          input, textarea { width: 100%; border: 1px solid #ddd; border-radius: 10px; padding: 12px; margin-bottom: 10px; font-size: 16px; outline: none; display: block; }
          textarea { height: 100px; resize: none; }
          .add-btn { width: 100%; background: #007aff; color: #fff; border: none; padding: 14px; border-radius: 10px; font-weight: 600; font-size: 16px; cursor: pointer; }
          .update-mode { background: #34c759; }
          
          .controls { padding: 12px 20px; display: flex; justify-content: flex-end; position: relative; }
          .sort-btn { background: #e5e5ea; padding: 6px 14px; border-radius: 20px; font-size: 13px; color: #3a3a3c; cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: 500; }
          .sort-menu { position: absolute; top: 40px; right: 20px; background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); display: none; flex-direction: column; z-index: 200; overflow: hidden; min-width: 140px; border: 1px solid rgba(0,0,0,0.05); }
          .sort-menu div { padding: 14px 16px; border-bottom: 1px solid #f2f2f7; font-size: 14px; cursor: pointer; color: #007aff; }
          .sort-menu div:active { background: #f2f2f7; }

          .note-item { background: #fff; margin-bottom: 1px; overflow: hidden; }
          .note-item.pinned { background: #fffcf0; }
          .note-header { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
          .note-title { font-weight: 500; font-size: 16px; flex: 1; padding-right: 10px; }
          .note-arrow { color: #ccc; font-size: 11px; margin-right: 8px; transition: transform 0.2s; }
          .note-content { display: none; padding: 18px 20px; background: #fafafa; border-top: 1px solid #f2f2f7; color: #3a3a3c; white-space: pre-wrap; line-height: 1.6; }
          
          .note-item.active .note-content { display: block; }
          .note-item.active .note-arrow { transform: rotate(90deg); color: #007aff; }
          
          .btn-group { display: flex; align-items: center; gap: 14px; }
          .icon-btn { cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s; }
          .del-btn-ios { width: 30px; height: 30px; background: #ff3b30; border-radius: 50%; color: white; box-shadow: 0 2px 6px rgba(255,59,48,0.3); }
          .pin-btn { color: #c7c7cc; font-size: 22px; }
          .pinned .pin-btn { color: #ffcc00; }
          .edit-btn { color: #007aff; font-size: 20px; }

          #modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.3); backdrop-filter: blur(5px); display: none; justify-content: center; align-items: center; z-index: 1000; }
          .modal { background: white; width: 280px; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
          .modal-body { padding: 24px 20px; font-weight: 600; font-size: 17px; text-align: center; }
          .modal-footer { display: flex; border-top: 1px solid #e5e5ea; }
          .modal-btn { flex: 1; padding: 14px; border: none; background: none; font-size: 17px; cursor: pointer; }
          .btn-cancel { border-right: 1px solid #e5e5ea; color: #007aff; }
          .btn-confirm { color: #ff3b30; font-weight: 600; }
          #status { text-align: center; font-size: 12px; color: #8e8e93; margin: 10px 0; height: 15px; }
        </style>
      </head>
      <body>
        <div id="modal-overlay">
          <div class="modal">
            <div class="modal-body">确认删除此条笔记吗？</div>
            <div class="modal-footer">
              <button class="modal-btn btn-cancel" onclick="closeModal()">取消</button>
              <button class="modal-btn btn-confirm" id="confirmDeleteBtn">删除</button>
            </div>
          </div>
        </div>

        <div class="header">
          <h2 style="margin:0; font-size:1.1rem;">📓 网页笔记本</h2>
          <a href="/logout" style="text-decoration:none; color:#8e8e93; font-size:13px;">退出</a>
        </div>
        
        <div class="editor-box">
          <input type="text" id="title" placeholder="笔记标题...">
          <textarea id="content" placeholder="内容..."></textarea>
          <button class="add-btn" id="mainBtn" onclick="handleMainBtnClick()">保存新笔记</button>
          <div id="status"></div>
        </div>

        <div class="controls">
            <div class="sort-btn" onclick="toggleMenu(event)">排序方式 <span id="currentSortText">↓</span></div>
            <div class="sort-menu" id="sortMenu">
                <div onclick="setSort(true)">最新优先 (倒序)</div>
                <div onclick="setSort(false)">最早优先 (正序)</div>
            </div>
        </div>

        <div id="list"></div>

        <script>
          let notes = ${rawData};
          let settings = ${rawSettings};
          let pendingDeleteIndex = null;
          let editingIndex = null;

          function render() {
            const listEl = document.getElementById('list');
            document.getElementById('sortMenu').style.display = 'none';
            document.getElementById('currentSortText').innerText = settings.isDesc ? '↓' : '↑';

            // 修正：星标置顶核心逻辑 (b.pinned - a.pinned)
            const sortedNotes = notes.map((item, index) => ({...item, originalIndex: index}))
              .sort((a, b) => {
                if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
                return settings.isDesc ? (b.originalIndex - a.originalIndex) : (a.originalIndex - b.originalIndex);
              });
            
            listEl.innerHTML = sortedNotes.map((item) => \`
              <div class="note-item \${item.pinned ? 'pinned' : ''}" id="item-\${item.originalIndex}">
                <div class="note-header" onclick="toggle(\${item.originalIndex})">
                  <span class="note-arrow">▶</span>
                  <span class="note-title">\${item.title}</span>
                  <div class="btn-group">
                    <span class="icon-btn edit-btn" onclick="event.stopPropagation(); startEdit(\${item.originalIndex})">✎</span>
                    <span class="icon-btn pin-btn" onclick="event.stopPropagation(); togglePin(\${item.originalIndex})">\${item.pinned ? '★' : '☆'}</span>
                    <div class="icon-btn del-btn-ios" onclick="event.stopPropagation(); showDeleteModal(\${item.originalIndex})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </div>
                  </div>
                </div>
                <div class="note-content">\${item.content}</div>
              </div>
            \`).join('');
          }

          function toggleMenu(e) {
            e.stopPropagation();
            const menu = document.getElementById('sortMenu');
            menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
          }

          async function setSort(val) {
            settings.isDesc = val;
            render();
            await sync(true);
          }

          window.onclick = function() { document.getElementById('sortMenu').style.display = 'none'; }

          // 修正后的展开逻辑：通过 Class 切换，不依赖 render 刷新，防止事件丢失
          function toggle(index) { 
            const el = document.getElementById('item-'+index);
            el.classList.toggle('active');
          }
          
          async function sync(onlySettings = false) {
            document.getElementById('status').innerText = "同步中...";
            const payload = onlySettings ? { settings } : { notes, settings };
            await fetch('/api/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            document.getElementById('status').innerText = "已保存";
          }

          function handleMainBtnClick() {
            const t = document.getElementById('title');
            const c = document.getElementById('content');
            if(!t.value.trim()) return;

            if(editingIndex !== null) {
              notes[editingIndex].title = t.value;
              notes[editingIndex].content = c.value;
              editingIndex = null;
              document.getElementById('mainBtn').innerText = "保存新笔记";
              document.getElementById('mainBtn').classList.remove('update-mode');
            } else {
              notes.push({ title: t.value, content: c.value, pinned: false });
            }
            
            t.value = ''; c.value = '';
            render(); sync();
          }

          function startEdit(index) {
            editingIndex = index;
            document.getElementById('title').value = notes[index].title;
            document.getElementById('content').value = notes[index].content;
            const btn = document.getElementById('mainBtn');
            btn.innerText = "更新此笔记";
            btn.classList.add('update-mode');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }

          function togglePin(index) {
            notes[index].pinned = !notes[index].pinned;
            render(); sync();
          }

          function showDeleteModal(index) {
            pendingDeleteIndex = index;
            document.getElementById('modal-overlay').style.display = 'flex';
          }
          function closeModal() {
            document.getElementById('modal-overlay').style.display = 'none';
            pendingDeleteIndex = null;
          }
          document.getElementById('confirmDeleteBtn').onclick = function() {
            if(pendingDeleteIndex !== null) {
              notes.splice(pendingDeleteIndex, 1);
              render(); sync(); closeModal();
            }
          };

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
    <title>登录 - 网页笔记本</title>
    <style>
      body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f7; }
      .card { background: white; padding: 30px; border-radius: 20px; width: 85%; max-width: 350px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
      input { width: 100%; padding: 14px; margin: 15px 0 5px 0; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; box-sizing: border-box; outline: none; }
      button { width: 100%; padding: 14px; background: #007aff; color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 16px; font-weight: bold; margin-top: 10px; }
      #err { color: #ff3b30; font-size: 14px; height: 20px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h3 style="margin:0">🔒 私密笔记本</h3>
      <div id="err"></div>
      <form id="loginForm" action="/login" method="POST" onsubmit="return check(event)">
        <input type="password" id="pw" name="password" placeholder="请输入密码" required autofocus>
        <button type="submit">进入</button>
      </form>
    </div>
    <script>
      function check(e) {
        const input = document.getElementById('pw');
        if (input.value !== "${correctPassword}") {
          e.preventDefault(); 
          document.getElementById('err').innerText = "密码错误！";
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
