export default {
  async fetch(request, env, ctx) {
    const PASSWORD = env.PASSWORD;
    const NOTES_KV = env.NOTES_KV;
    const url = new URL(request.url);
    const method = request.method;
    const cookie = request.headers.get("Cookie") || "";
    async function checkAuth(cookieHeader) {
      const match = cookieHeader.match(/auth_token=([^;]+)/);
      if (!match) return false;
      const token = match[1];
      return !!(await NOTES_KV.get("session_" + token));
    }

    let isLogged = await checkAuth(cookie);
if (!isLogged && cookie.includes("auth_token=")) {
  return new Response("登录已过期", {
    status: 302,
    headers: {
      "Location": "/",
      "Set-Cookie": "auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    }
  });
}

    if (url.pathname === "/logout") {
      const token = (cookie.match(/auth_token=([^;]+)/) || [])[1];
      if (token) await NOTES_KV.delete("session_" + token);
      return new Response("退出中...", {
        status: 302,
        headers: {
          "Location": "/",
          "Set-Cookie": "auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
        },
      });
    }

    if (method === "POST" && request.headers.get("Content-Type")?.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      if (formData.get("password") === PASSWORD) {
        const token = crypto.randomUUID();
        await NOTES_KV.put("session_" + token, "1", { expirationTtl: 86400 });
        return new Response("OK", {
          status: 302,
          headers: {
            "Location": "/",
            "Set-Cookie": `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
          },
        });
      }
      return new Response(renderLoginPage(true), {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    if (!isLogged) {
      return new Response(renderLoginPage(), {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
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
          .insert-link-btn {
          width: 100%;
          background: #f0f0f5;
          color: #007aff;
          border: 1px solid #ddd;
          padding: 10px;
          border-radius: 10px;
          font-weight: 500;
          font-size: 15px;
          cursor: pointer;
          margin-bottom: 10px;}
          #link-modal-overlay {
          position: fixed; top:0; left:0; width:100%; height:100%;
          background: rgba(0,0,0,0.3); backdrop-filter: blur(5px);
          display: none; justify-content: center; align-items: center; z-index: 1000;}
          .link-modal {
          background: white; width: 90%; max-width: 360px; border-radius: 14px;
          overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); padding: 20px;}
          .link-modal h3 { margin: 0 0 15px; font-size: 17px; text-align: center; }
          .link-modal input {
          width: 100%; padding: 12px; margin-bottom: 12px;
          border: 1px solid #ddd; border-radius: 10px; font-size: 15px;}
          .link-modal-btn-group {
          display: flex; justify-content: flex-end; gap: 10px; margin-top: 5px;}
          .link-modal-btn {
          padding: 10px 18px; border-radius: 10px; border: none;
          font-size: 15px; font-weight: 500; cursor: pointer;}
          .btn-link-insert { background: #007aff; color: white; }
          .btn-link-cancel { background: #f0f0f5; color: #3a3a3c; }
          .note-content a, .note-title a { color: #007aff !important; text-decoration: underline !important; }
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
  <div id="link-modal-overlay">
  <div class="link-modal">
    <h3>插入链接</h3>
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
      <label style="font-size:14px; color:#8e8e93; white-space:nowrap; min-width:70px;">链接地址(URL)</label>
      <input type="text" id="link-url" placeholder="https://xxx.xxx.xxx/xxx" style="flex:1; margin-bottom:0;">
    </div>
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
      <label style="font-size:14px; color:#8e8e93; white-space:nowrap; min-width:70px;">显示名称</label>
      <input type="text" id="link-text" placeholder="" style="flex:1; margin-bottom:0;">
    </div>
    <div class="link-modal-btn-group">
      <button class="link-modal-btn btn-link-cancel" onclick="closeLinkModal()">取消</button>
      <button class="link-modal-btn btn-link-insert" onclick="insertLink()">插入</button>
    </div>
  </div>
</div>

        <div id="mainView" class="view-section">
          <div class="header">
            <h2 style="margin:0; font-size:1.1rem;">📓 网页笔记本</h2>
            <div style="display: flex; align-items: center; gap: 15px;">
              <span onclick="openEditor()" style="color:#007aff; font-size:13px; font-weight:bold; cursor:pointer;"><h3>新建笔记</h3></span>
              <a href="/logout" style="text-decoration:none; color:#ff3b30; font-size:13px;"><h3>退出</h3></a>
            </div>
          </div>

          <div class="controls" style="padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; gap: 10px; position: relative;">
              <input type="text" id="search-input" placeholder="🔍 搜索标题或内容..." oninput="render()" style="display: inline-block !important; width: 60% !important; max-width: 200px !important; margin: 0 !important; padding: 6px 12px !important; font-size: 14px !important; background: #e5e5ea !important; border: none !important; border-radius: 10px !important; height: 32px !important; box-sizing: border-box !important;">
              <div class="sort-btn" onclick="toggleMenu(event)" style="flex-shrink: 0; margin: 0 !important; height: 32px !important; box-sizing: border-box !important; display: flex; align-items: center;">排序方式 <span id="currentSortText">↓</span></div>
              
              <div class="sort-menu" id="sortMenu">
                  <div onclick="setSort(true)">最新优先(倒序↓)</div>
                  <div onclick="setSort(false)">最早优先(正序↑)</div>
              </div>
          </div>

          <div id="list"></div>
        </div>

        <div id="toast-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.05); display: none; justify-content: center; align-items: center; z-index: 9999;">
          <div style="background: rgba(28, 28, 30, 0.96); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); padding: 22px 36px; border-radius: 16px; text-align: center; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.1);">
            <div id="toastIcon" style="font-size: 32px; margin-bottom: 8px;"></div>
            <div id="toastText" style="font-size: 16px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px;"></div>
          </div>
        </div>

        <div id="editorView" style="display: none;">
          <div class="header">
            <h3 style="margin:0; font-size:1.1rem;" id="editorPanelTitle">📓 新建笔记</h3>
            <span onclick="closeEditor()" style="color:#ff3b30; font-size:13px; font-weight:bold; cursor:pointer;"><h3>取消</h3></span>
          </div>
          
          <div class="editor-box">
            <input type="text" id="title" placeholder="笔记标题..." onfocus="lastActiveInput = this">
            <textarea id="content" placeholder="内容..." style="height: 250px; resize: none;" onfocus="lastActiveInput = this"></textarea>
            <button class="insert-link-btn" onclick="showInsertLinkModal()">🔗 插入链接</button>
            <button class="add-btn" id="mainBtn" onclick="handleMainBtnClick()" style="width: 100%; background: #007aff; color: #fff; border: none; padding: 14px; border-radius: 10px; font-weight: 600; font-size: 16px; cursor: pointer; margin-top: 15px;">保存新笔记</button>
          </div>
        </div>

        <script>
          let rawData = ${rawData}; 
          let notes = Array.isArray(rawData) ? rawData : [];
          let settings = ${rawSettings};
          let pendingDeleteIndex = null;
          let editingIndex = null;
          let lastActiveInput = null;

          function render() {
  const listEl = document.getElementById('list');
  if (!listEl) return;
  
  document.getElementById('sortMenu').style.display = 'none';
  document.getElementById('currentSortText').innerText = settings.isDesc ? '↓' : '↑';

  let displayNotes = notes.map((item, index) => ({ ...item, originalIndex: index }));
  displayNotes.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return settings.isDesc ? (b.originalIndex - a.originalIndex) : (a.originalIndex - b.originalIndex);
  });

  const keyword = document.getElementById('search-input')?.value.trim().toLowerCase() || '';
  let html = '';
  let count = 0;

  for (let i = 0; i < displayNotes.length; i++) {
    try {
      const item = displayNotes[i];
      if (!item) continue;

      const itemTitle = (item.title || '').toLowerCase();
      const itemContent = (item.content || '').toLowerCase();
      if (keyword && !(itemTitle.includes(keyword) || itemContent.includes(keyword))) {
        continue;
      }
      
      count++;
      const originalIdx = item.originalIndex;
      const pinnedClass = item.pinned ? ' pinned' : '';
      
      html += '<div class="note-item' + pinnedClass + '" id="item-' + originalIdx + '">';
      html += '  <div class="note-header" onclick="toggle(' + originalIdx + ')">';
      html += '    <span class="note-arrow">▶</span>';
      html += '    <span class="note-title">' + (item.title || '无标题') + '</span>';
      html += '    <div class="btn-group">';
      html += '      <span class="icon-btn edit-btn" onclick="event.stopPropagation(); startEdit(' + originalIdx + ')">✎</span>';
      html += '      <span class="icon-btn pin-btn" onclick="event.stopPropagation(); togglePin(' + originalIdx + ')">' + (item.pinned ? '★' : '☆') + '</span>';
      html += '      <div class="icon-btn del-btn-ios" onclick="event.stopPropagation(); showDeleteModal(' + originalIdx + ')">';
      html += '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
      html += '      </div>';
      html += '    </div>';
      html += '  </div>';
      html += '  <div class="note-content">' + (item.content || '无内容') + '</div>';
      html += '</div>';
      
    } catch (e) {
      console.error("渲染单条笔记出错:", e);
    }
  }

  if (count === 0) {
    html = '<div style="text-align:center; padding:50px; color:#8e8e93;">暂无笔记</div>';
  }
  
  listEl.innerHTML = html;
}

const toggleMenu = (e) => {
  e.stopPropagation();
  const menu = document.getElementById('sortMenu');
  if (menu) menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
};

const setSort = async (val) => {
  settings.isDesc = val;
  render();
  try {
    await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: settings }) 
    });
  } catch(e) { console.error(e); }
};

window.onclick = () => {
  const menu = document.getElementById('sortMenu');
  if (menu) menu.style.display = 'none';
};

const toggle = (index) => {
  const el = document.getElementById('item-' + index);
  if (el) el.classList.toggle('active');
};
    async function sync(customNotes) {
    const dataToSend = customNotes || notes;

    if (!Array.isArray(dataToSend)) {
        console.error("⚠️ 异常数据警报：", dataToSend);
    }

    try {
        const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: dataToSend })
        });
        return res.ok;
    } catch (e) {
        console.error("同步异常:", e);
        return false;}}

          function showInsertLinkModal() {
          document.getElementById('link-modal-overlay').style.display = 'flex';
          document.getElementById('link-url').focus();
}
          function closeLinkModal() {
          document.getElementById('link-modal-overlay').style.display = 'none';
          document.getElementById('link-url').value = '';
          document.getElementById('link-text').value = '';
}
          function insertLink() {
          const urlInput = document.getElementById('link-url');
          const textInput = document.getElementById('link-text');
          let url = urlInput.value.trim();
          let text = textInput.value.trim();

          if (!url) return;
          if (!text) text = url;

          url = url.replace(/"/g, '&quot;');
          text = text.replace(/"/g, '&quot;');

          const linkHtml = '<a href="' + url + '">' + text + '</a>';
          const targetInput = lastActiveInput || document.getElementById('content');

          const start = targetInput.selectionStart;
          const end = targetInput.selectionEnd;
          const before = targetInput.value.substring(0, start);
          const after = targetInput.value.substring(end);
          targetInput.value = before + linkHtml + after;
          targetInput.selectionStart = targetInput.selectionEnd = start + linkHtml.length;
          targetInput.focus();
          closeLinkModal();}

          function showToast(icon, text) {
            const overlay = document.getElementById('toast-overlay');
            document.getElementById('toastIcon').innerText = icon;
            document.getElementById('toastText').innerText = text;
            overlay.style.display = 'flex';
            setTimeout(() => {
              overlay.style.display = 'none';
            },999);
          }

          function openEditor() {
            editingIndex = null;
            document.getElementById('editorPanelTitle').innerText = "📓 新建笔记";
            const btn = document.getElementById('mainBtn');
            btn.innerText = "保存新笔记";
            btn.style.background = "#007aff";
            btn.classList.remove('update-mode');
            document.getElementById('title').value = '';
            document.getElementById('content').value = '';

            document.getElementById('mainView').style.display = 'none';

            const listEl = document.getElementById('list');
            if (listEl) listEl.style.display = 'none';

            document.getElementById('editorView').style.display = 'block';
            window.scrollTo({ top: 0 });
          }

          function closeEditor() {
            document.getElementById('list').style.display = 'block';
            document.getElementById('editorView').style.display = 'none';
            document.getElementById('mainView').style.display = 'block';

            const listEl = document.getElementById('list');
            if (listEl) listEl.style.display = 'block';
            
            editingIndex = null;
            window.scrollTo({ top: 0 });
          }

          function handleMainBtnClick() {
            const t = document.getElementById('title');
            const c = document.getElementById('content');
            if (!t.value.trim() || !c.value.trim()) {
              showToast("⚠️", "请填写标题和内容");
              return;
            }

            let isEdit = (editingIndex !== null);
            let nextNotes = JSON.parse(JSON.stringify(notes));
            
            if (isEdit) {
              nextNotes[editingIndex].title = t.value;
              nextNotes[editingIndex].content = c.value;
            } else {
              nextNotes.push({ title: t.value, content: c.value, pinned: false });
            }

            sync(nextNotes).then(success => {
              if (success) {
            notes = nextNotes;
            t.value = ''; c.value = '';
            closeEditor(); 
            document.getElementById('list').style.display = 'block';
                
                if (isEdit) {
                  editingIndex = null;
                  showToast("✅", "笔记修改成功");
                } else {
                  showToast("✅", "笔记保存成功");
                }
                
                render();
              } else {
                if (isEdit) {
                  showToast("❌", "笔记修改失败，请重试");
                } else {
                  showToast("❌", "笔记保存失败，请重试");
                }
              }
            });
        }

            function startEdit(index) {
            editingIndex = index;
            document.getElementById('editorPanelTitle').innerText = "📝 修改笔记";
            document.getElementById('title').value = notes[index].title;
            document.getElementById('content').value = notes[index].content;
            
            const btn = document.getElementById('mainBtn');
            btn.innerText = "更新此笔记";
            btn.style.background = "#34c759"; 
            btn.classList.add('update-mode');
            
            document.getElementById('mainView').style.display = 'none';
            document.getElementById('editorView').style.display = 'block';
            window.scrollTo({ top: 0 });
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
              let nextNotes = JSON.parse(JSON.stringify(notes));
              nextNotes.splice(pendingDeleteIndex, 1);
              closeModal();

              sync(nextNotes).then(success => {
                if (success) {
                  notes = nextNotes;
                  showToast("✅", "笔记删除成功");
                  render();
                } else {
                  showToast("❌", "笔记删除失败，请重试");
                }
              });
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

function renderLoginPage(hasError = false) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>网页笔记本 - 登录</title>
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
      <h2 style="margin:0">🔒 私密笔记本</h2>
      <div id="err"></div>
      <form action="" method="POST">
        <input type="password" id="pw" name="password" placeholder="请输入密码" required autofocus>
        <button type="submit">进入</button>
      </form>
    </div>
    <script>
  if ("${hasError}" === "true") {
    document.getElementById('err').innerText = "密码错误！";
  }
</script>
  </body>
  </html>
  `;
}
