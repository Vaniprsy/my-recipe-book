// public/script.js - full working version
// Helpers
function el(id) { return document.getElementById(id); }
function getUser() { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch(e) { return null; } }

// GLOBAL viewRecipe so onclick in HTML works
function viewRecipe(id) {
  localStorage.setItem('selectedRecipe', id);
  window.location.href = '/view.html';
}

// Main logic for pages
document.addEventListener('DOMContentLoaded', () => {

  // ---------- LOGIN (index.html) ----------
  const loginForm = el('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = el('username').value.trim();
      const email = el('email').value.trim();
      if (!username) return alert('Please enter your name');
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ username, email })
        });
        if (!res.ok) throw new Error('Login failed');
        const user = await res.json();
        localStorage.setItem('user', JSON.stringify(user));
        window.location.href = '/dashboard.html';
      } catch (err) { console.error(err); alert('Login error'); }
    });
    return;
  }

  // ---------- DASHBOARD ----------
  const recipeList = el('recipeList');
  const searchInput = el('search');
  const userDisplay = el('userDisplay');
  const storedUser = getUser();
  if (userDisplay && storedUser) userDisplay.textContent = storedUser.username || 'Guest';

  if (recipeList) {
    // load top recipes
    loadTopRecipes();

    // search
    if (searchInput) {
      searchInput.addEventListener('input', async (e) => {
        const q = e.target.value.trim().toLowerCase();
        if (!q) { loadTopRecipes(); return; }
        try {
          const res = await fetch('/api/recipes');
          const all = await res.json();
          const filtered = all.filter(r => (r.name||'').toLowerCase().includes(q) || (r.ingredients||'').toLowerCase().includes(q));
          renderRecipesToContainer(filtered, recipeList);
        } catch (err) { console.error('Search error', err); }
      });
    }
  }

  async function loadTopRecipes() {
    try {
      const res = await fetch('/api/recipes/top');
      const data = await res.json();
      renderRecipesToContainer(data, recipeList);
    } catch (err) {
      console.error('Load top recipes error', err);
      if (recipeList) recipeList.innerHTML = '<p style="color:#999;text-align:center;">Cannot load recipes</p>';
    }
  }

  function renderRecipesToContainer(recipes, container) {
    if (!container) return;
    if (!recipes || recipes.length === 0) {
      container.innerHTML = '<p style="color:#999;text-align:center;">No recipes found.</p>';
      return;
    }
    container.innerHTML = recipes.map(r => `
      <div class="recipe-card">
        <div class="recipe-img">
          <img src="${r.image || 'https://picsum.photos/400/250?grayscale'}" alt="${escapeHtml(r.name)}" onerror="this.src='https://picsum.photos/400/250?grayscale'">
        </div>
        <div class="recipe-content">
          <h3>${escapeHtml(r.name)}</h3>
          <p>${escapeHtml(r.description || '')}</p>
          <button class="side-btn" onclick="viewRecipe('${r._id}')">View</button>
        </div>
      </div>
    `).join('');
  }

  // ---------- VIEW ALL ----------
  const allContainer = el('allRecipes');
  if (allContainer) {
    fetch('/api/recipes').then(r => r.json()).then(data => renderRecipesToContainer(data, allContainer)).catch(err => {
      console.error('All recipes error', err); allContainer.innerHTML = '<p>Error loading recipes</p>';
    });
  }

  // ---------- VIEW (detail) ----------
  if (window.location.pathname.endsWith('/view.html') || window.location.pathname.endsWith('view.html')) {
    const id = localStorage.getItem('selectedRecipe');
    const detail = el('recipeDetail');
    if (!id) { if (detail) detail.innerHTML = '<p>No recipe selected.</p>'; return; }
    fetch(`/api/recipes/${id}`)
      .then(r => r.json())
      .then(data => {
        const r = data.recipe;
        const fb = data.feedbacks || [];
        if (!r) { detail.innerHTML = '<p>Recipe not found.</p>'; return; }
        detail.innerHTML = `
          <h2>${escapeHtml(r.name)}</h2>
          <p><strong>By:</strong> ${escapeHtml(r.user)}</p>
          <div class="recipe-img"><img src="${r.image || 'https://picsum.photos/600/400'}" onerror="this.src='https://picsum.photos/600/400'"></div>
          <p><strong>Ingredients:</strong> ${escapeHtml(r.ingredients || 'N/A')}</p>
          <p>${escapeHtml(r.description || '')}</p>
          <div class="feedback-box">
            <h3>Feedback</h3>
            <div id="feedbackList">${fb.length ? fb.map(f=>`<p><b>${escapeHtml(f.user)}:</b> ${escapeHtml(f.comment)}</p>`).join('') : '<p>No feedback yet.</p>'}</div>
            <textarea id="feedbackInput" placeholder="Write feedback..."></textarea>
            <button id="submitFeedback" class="side-btn">Submit</button>
          </div>
        `;
        el('submitFeedback').addEventListener('click', async () => {
          const comment = el('feedbackInput').value.trim();
          if (!comment) return alert('Write feedback');
          const user = getUser();
          try {
            const res = await fetch(`/api/recipes/${id}/feedback`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ user: user?.username || 'Guest', comment })
            });
            if (!res.ok) throw new Error('Feedback submit failed');
            alert('Feedback submitted');
            location.reload();
          } catch (err) { console.error(err); alert('Error submitting feedback'); }
        });
      })
      .catch(err => { console.error('Fetch recipe error', err); if (detail) detail.innerHTML = '<p>Error loading recipe</p>'; });
  }

  // ---------- PROFILE ----------
  if (window.location.pathname.endsWith('/profile.html') || window.location.pathname.endsWith('profile.html')) {
    const user = getUser();
    const area = el('profileArea');
    if (!user) { if (area) area.innerHTML = '<p>Please login first.</p>'; return; }
    fetch(`/api/user/${user._id}`).then(r=>r.json()).then(data => {
      const u = data.user; const rec = data.recipes || [];
      area.innerHTML = `
        <div id="profilePic"><img src="${u.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" alt="profile"></div>
        <div>
          <h3>${escapeHtml(u.username)}</h3>
          <p>Email: ${escapeHtml(u.email || 'Not provided')}</p>
          <form id="uploadForm">
            <input type="file" id="profileFile" accept="image/*"><br><br>
            <button type="submit" class="side-btn">Upload</button>
          </form>
          <h4>My Recipes</h4>
          <div id="myRecipes">${rec.length ? rec.map(r => `<p>🍴 ${escapeHtml(r.name)}</p>`).join('') : '<p>No recipes added.</p>'}</div>
        </div>
      `;
      el('uploadForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const file = el('profileFile').files[0];
        if (!file) return alert('Select an image');
        const fd = new FormData(); fd.append('profilePic', file);
        try {
          const res = await fetch(`/api/user/${user._id}/upload`, { method: 'POST', body: fd });
          if (!res.ok) throw new Error('Upload failed');
          const j = await res.json();
          user.profilePic = j.profilePic;
          localStorage.setItem('user', JSON.stringify(user));
          alert('Profile updated'); location.reload();
        } catch (err) { console.error(err); alert('Upload error'); }
      });
    }).catch(err=>{ console.error(err); if (area) area.innerHTML = '<p>Error loading profile</p>'; });
  }

  // ---------- ADD RECIPE ----------
  if (window.location.pathname.endsWith('/addRecipe.html') || window.location.pathname.endsWith('addRecipe.html')) {
    const form = el('addRecipeForm');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const user = getUser();
      const fd = new FormData();
      fd.append('name', el('rname').value.trim());
      fd.append('category', el('rcat').value.trim());
      fd.append('ingredients', el('ring').value.trim());
      fd.append('description', el('rdesc').value.trim());
      fd.append('user', user?.username || 'Anonymous');
      fd.append('userId', user?._id || '');
      if (el('rimage').files[0]) fd.append('image', el('rimage').files[0]);
      else fd.append('imageUrl', el('rimageUrl').value.trim());
      try {
        const res = await fetch('/api/recipes', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Add recipe failed');
        alert('Recipe added'); window.location.href = '/viewAll.html';
      } catch (err) { console.error(err); alert('Error adding recipe'); }
    });
  }

}); // DOMContentLoaded end

// small helper to avoid XSS in innerHTML
function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}
