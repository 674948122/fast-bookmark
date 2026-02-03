(function() {
  // Prevent multiple injections
  if (document.getElementById('fast-bookmark-container')) {
    console.log('Fast Bookmark: Already injected, skipping initialization.');
    return;
  }

  let isVisible = false;
  let bookmarks = [];
  let bookmarkTree = [];
  let expandedFolders = new Set(['1', '2']); // Default expand bar and other
  let fuse = null;
  let selectedIndex = -1;
  let results = [];
  let settings = {
    theme: 'auto',
    threshold: 0.4,
    showPath: true,
    showRecent: true
  };
  let saveSidebarStateTimer = null;
  let scrollSaveTimer = null;

  // Create Shadow DOM container
  const container = document.createElement('div');
  container.id = 'fast-bookmark-container';
  container.style.display = 'none !important'; // Initially hidden to prevent flash
  container.style.position = 'fixed !important';
  container.style.top = '0 !important';
  container.style.left = '0 !important';
  container.style.zIndex = '2147483647 !important';
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: 'open' });

  // Styles
  const style = document.createElement('style');
  function updateStyles() {
    const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    style.textContent = `
      :host {
        --primary-color: #3730a3; /* Darker Indigo for better contrast */
        --bg-color: ${isDark ? '#111827' : '#ffffff'};
        --text-color: ${isDark ? '#f3f4f6' : '#111827'};
        --secondary-text: ${isDark ? '#9ca3af' : '#4b5563'}; /* Increased contrast */
        --border-color: ${isDark ? '#374151' : '#e5e7eb'};
        --hover-bg: ${isDark ? '#1f2937' : '#f3f4f6'};
        --selected-bg: ${isDark ? '#312e81' : '#e0e7ff'};
        --shadow: ${isDark ? '-10px 0 25px -5px rgba(0, 0, 0, 0.6)' : '-10px 0 25px -5px rgba(0, 0, 0, 0.1)'};
        --accent-color: var(--primary-color);
        text-align: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol";
        line-height: 1.4;
      }
      
      :host(.fast-bookmark-searching) {
        --accent-color: ${isDark ? '#f59e0b' : '#6d28d9'};
      }
      
      :host *, :host *::before, :host *::after {
        box-sizing: border-box;
      }

      #fast-bookmark-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.4);
        display: none;
        justify-content: flex-end;
        align-items: stretch;
        z-index: 2147483647;
        backdrop-filter: blur(2px);
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
      }

      #fast-bookmark-overlay.visible {
        display: flex;
        opacity: 1;
      }

      #fast-bookmark-modal {
        width: 500px;
        max-width: 90vw;
        height: 100vh;
        background: var(--bg-color);
        box-shadow: var(--shadow);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      #fast-bookmark-overlay.visible #fast-bookmark-modal {
        transform: translateX(0);
      }

      #fast-bookmark-sidebar-header {
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      #fast-bookmark-sidebar-title {
        font-size: 24px;
        font-weight: 600;
        color: var(--text-color);
        margin: 0;
      }

      #fast-bookmark-settings-btn {
        cursor: pointer;
        color: var(--secondary-text);
        display: flex;
        align-items: center;
        transition: color 0.2s;
      }

      #fast-bookmark-settings-btn:hover {
        color: var(--primary-color);
      }

      #fast-bookmark-search-container {
        padding: 0 24px 16px 24px;
      }

      #fast-bookmark-search-input-wrapper {
        display: flex;
        align-items: center;
        background: var(--hover-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 8px 12px;
        transition: border-color 0.2s;
      }

      #fast-bookmark-search-input-wrapper:focus-within {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(55, 48, 163, 0.1);
      }

      #fast-bookmark-search-input {
        width: 100%;
        border: none;
        outline: none;
        font-size: 14px;
        color: var(--text-color);
        background: transparent;
      }

      #fast-bookmark-search-icon {
        width: 16px;
        height: 16px;
        color: var(--secondary-text);
        margin-left: 8px;
      }

      #fast-bookmark-results-list {
        flex: 1;
        overflow-y: auto;
        margin: 0;
        padding: 0 8px;
        list-style: none;
      }

      #fast-bookmark-results-list::-webkit-scrollbar {
        width: 6px;
      }

      #fast-bookmark-results-list::-webkit-scrollbar-track {
        background: transparent;
      }

      #fast-bookmark-results-list::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: 3px;
      }

      #fast-bookmark-results-list::-webkit-scrollbar-thumb:hover {
        background: var(--secondary-text);
      }

      .fast-bookmark-result-item {
        width: 100%;
        box-sizing: border-box;
        margin: 0;
        border: 0;
        background: transparent;
        padding: 8px 16px;
        display: flex;
        align-items: center;
        cursor: pointer;
        transition: background 0.1s;
        gap: 8px;
        user-select: none;
      }

      .fast-bookmark-result-item:hover {
        background: var(--hover-bg);
      }

      .fast-bookmark-result-item.fast-bookmark-selected {
        background: var(--selected-bg);
      }

      .fast-bookmark-tree-node {
        display: flex;
        flex-direction: column;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .fast-bookmark-folder-toggle {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        cursor: pointer;
        transition: transform 0.2s;
        color: var(--secondary-text);
      }

      .fast-bookmark-folder-toggle.fast-bookmark-expanded {
        transform: rotate(90deg);
      }

      .fast-bookmark-folder-icon {
        color: #f59e0b; /* Slightly warmer amber */
        display: flex;
      }

      .fast-bookmark-node-content {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        overflow: hidden;
      }

      .fast-bookmark-indent {
        width: 16px;
        flex-shrink: 0;
      }

      .fast-bookmark-result-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        flex-grow: 1;
      }

      .fast-bookmark-result-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .fast-bookmark-result-path {
        font-size: 10px;
        color: var(--accent-color);
        background: ${isDark ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.04)'};
        padding: 1px 6px;
        border: 1px solid var(--accent-color);
        border-radius: 4px;
        white-space: nowrap;
        display: ${settings.showPath ? 'inline-block' : 'none'};
      }

      .fast-bookmark-result-title {
        font-weight: 500;
        font-size: 14px;
        color: var(--text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .fast-bookmark-result-url {
        font-size: 12px;
        color: var(--secondary-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 1px;
      }

      .fast-bookmark-favicon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .fast-bookmark-highlight {
        color: var(--accent-color);
        font-weight: 700;
        background: ${isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.12)'};
        padding: 0 1px;
        border-radius: 2px;
      }

      #fast-bookmark-empty-state {
        display: none;
        flex: 1;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        padding: 0 24px;
        text-align: center;
        color: var(--secondary-text);
      }

      #fast-bookmark-empty-state svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      #fast-bookmark-empty-state .title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-color);
        margin-bottom: 4px;
      }

      #fast-bookmark-empty-state .desc {
        font-size: 14px;
      }

      #fast-bookmark-footer {
        padding: 8px 16px;
        background: var(--hover-bg);
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: flex-end;
        gap: 16px;
      }

      .key-hint {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--secondary-text);
      }

      .key-cap {
        background: var(--bg-color);
        border: 1px solid var(--border-color);
        border-radius: 3px;
        padding: 1px 4px;
        font-family: monospace;
        font-weight: 600;
        color: var(--text-color);
      }
    `;
  }
  shadow.appendChild(style);

  // HTML Structure
  const overlay = document.createElement('div');
  overlay.id = 'fast-bookmark-overlay';
  overlay.innerHTML = `
    <div id="fast-bookmark-modal">
      <div id="fast-bookmark-sidebar-header">
        <h2 id="fast-bookmark-sidebar-title">${chrome.i18n.getMessage('extensionName')}</h2>
        <div id="fast-bookmark-settings-btn" title="Theme"></div>
      </div>
      <div id="fast-bookmark-search-container">
        <div id="fast-bookmark-search-input-wrapper">
          <input type="text" id="fast-bookmark-search-input" placeholder="${chrome.i18n.getMessage('searchPlaceholder')}" autocomplete="off">
          <svg id="fast-bookmark-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
      </div>
      <ul id="fast-bookmark-results-list"></ul>
      <div id="fast-bookmark-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <div class="title">${chrome.i18n.getMessage('noMatches')}</div>
        <div class="desc">${chrome.i18n.getMessage('noMatchesDesc')}</div>
      </div>
    </div>
  `;
  shadow.appendChild(overlay);

  const searchInput = shadow.getElementById('fast-bookmark-search-input');
  const resultsList = shadow.getElementById('fast-bookmark-results-list');
  const emptyState = shadow.getElementById('fast-bookmark-empty-state');
  const settingsBtn = shadow.getElementById('fast-bookmark-settings-btn');

  function updateThemeToggleIcon() {
    if (!settingsBtn) return;
    const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    settingsBtn.innerHTML = isDark
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79z"></path></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>';
  }
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && systemDark);
      const nextTheme = isDark ? 'light' : 'dark';
      chrome.storage.sync.set({ theme: nextTheme }, () => {
        settings.theme = nextTheme;
        updateStyles();
        updateThemeToggleIcon();
      });
    });
  }

  // Load settings
  function loadSettings(callback) {
    chrome.storage.sync.get(
      { theme: 'auto', threshold: 0.4, showPath: true, showRecent: true },
      (items) => {
        settings = items;
        updateStyles();
        updateThemeToggleIcon();
        if (callback) callback();
      }
    );
  }

  // Initialize Fuse.js
  function initFuse() {
    if (bookmarks.length > 0) {
      fuse = new Fuse(bookmarks, {
        keys: [
          { name: 'title', weight: 0.7 },
          { name: 'url', weight: 0.3 }
        ],
        threshold: settings.threshold,
        distance: 100,
        includeMatches: true,
        minMatchCharLength: 2
      });
    }
  }

  function setFavicon(imgEl, pageUrl) {
    function applyInline() {
      const svg = document.createElement('svg');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'currentColor');
      svg.className = 'fast-bookmark-favicon';
      svg.innerHTML = '<path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 1v4h4"/>';
      imgEl.replaceWith(svg);
    }
    const extUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
    imgEl.onerror = () => {
      let u;
      try {
        u = new URL(pageUrl);
      } catch (e) {
        applyInline();
        return;
      }
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        imgEl.onerror = () => {
          applyInline();
        };
        imgEl.src = `https://www.google.com/s2/favicons?domain=${u.hostname}`;
      } else {
        applyInline();
      }
    };
    imgEl.src = extUrl;
  }
  // Fetch bookmarks
  function fetchBookmarks() {
    chrome.runtime.sendMessage({ action: "getBookmarks" }, (response) => {
      bookmarks = response.flattened;
      bookmarkTree = response.tree;
      initFuse();
    });
  }

  // Render results
  function renderResults() {
    resultsList.innerHTML = '';
    if (results.length === 0 && searchInput.value) {
      emptyState.style.display = 'flex';
      resultsList.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      resultsList.style.display = 'block';
      
      if (results.length > 0) {
        doRender(results);
      } else {
        // Show tree view when no search
        renderTreeView();
      }
    }
  }

  function renderTreeView() {
    resultsList.innerHTML = '';
    // Skip the root node if it's just a wrapper
    const nodes = bookmarkTree[0].children || bookmarkTree;
    nodes.forEach(node => {
      renderNode(node, resultsList, 0);
    });
  }

  function renderNode(node, container, depth) {
    const li = document.createElement('li');
    li.className = 'fast-bookmark-tree-node';
    
    const itemEl = document.createElement('div');
    itemEl.className = 'fast-bookmark-result-item';
    itemEl.style.paddingLeft = `${depth * 16 + 16}px`;

    const isFolder = !!node.children;
    const isExpanded = expandedFolders.has(node.id);

    if (isFolder) {
      const toggle = document.createElement('div');
      toggle.className = `fast-bookmark-folder-toggle ${isExpanded ? 'fast-bookmark-expanded' : ''}`;
      toggle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      itemEl.appendChild(toggle);

      const icon = document.createElement('div');
      icon.className = 'fast-bookmark-folder-icon';
      icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg>`;
      itemEl.appendChild(icon);
    } else {
      // Indent for leaf nodes to align with folders that have toggles
      const spacer = document.createElement('div');
      spacer.className = 'fast-bookmark-indent';
      itemEl.appendChild(spacer);

      const favicon = document.createElement('img');
      favicon.className = 'fast-bookmark-favicon';
      setFavicon(favicon, node.url);
      itemEl.appendChild(favicon);
    }

    const info = document.createElement('div');
    info.className = 'fast-bookmark-result-info';
    
    let title = node.title;
    if (!title && node.url) {
      try {
        const urlObj = new URL(node.url);
        title = urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
      } catch (e) {
        title = node.url;
      }
    }

    info.innerHTML = `<span class="fast-bookmark-result-title">${title || 'Untitled'}</span>`;
    itemEl.appendChild(info);

    itemEl.addEventListener('click', (e) => {
      if (isFolder) {
        if (expandedFolders.has(node.id)) {
          expandedFolders.delete(node.id);
        } else {
          expandedFolders.add(node.id);
        }
        renderResults();
        if (saveSidebarStateTimer) clearTimeout(saveSidebarStateTimer);
        saveSidebarStateTimer = setTimeout(() => {
          chrome.runtime.sendMessage({
            action: "saveSidebarState",
            state: { expandedFolders: Array.from(expandedFolders), scrollTop: resultsList.scrollTop }
          });
        }, 200);
      } else {
        if (e.altKey) {
          navigator.clipboard.writeText(node.url);
        } else {
          openBookmark(node, true);
        }
      }
    });

    li.appendChild(itemEl);

    if (isFolder && isExpanded && node.children) {
      const childrenContainer = document.createElement('ul');
      childrenContainer.style.listStyle = 'none';
      childrenContainer.style.padding = '0';
      node.children.forEach(child => {
        renderNode(child, childrenContainer, depth + 1);
      });
      li.appendChild(childrenContainer);
    }

    container.appendChild(li);
  }

  function doRender(displayResults) {
    resultsList.innerHTML = '';
    displayResults.forEach((result, index) => {
      const item = result.item || result;
      const li = document.createElement('li');
      li.className = 'fast-bookmark-tree-node';
      
      const itemEl = document.createElement('div');
      itemEl.className = `fast-bookmark-result-item ${index === selectedIndex ? 'fast-bookmark-selected' : ''}`;
      // Add left padding to align with root level tree nodes (16px indent)
      itemEl.style.paddingLeft = '16px'; 
      
      const highlightText = (text, key) => {
        if (!result.matches) return text;
        const match = result.matches.find(m => m.key === key);
        if (!match) return text;

        let highlighted = '';
        let lastIndex = 0;
        match.indices.forEach(([start, end]) => {
          highlighted += text.substring(lastIndex, start);
          highlighted += `<span class="fast-bookmark-highlight">${text.substring(start, end + 1)}</span>`;
          lastIndex = end + 1;
        });
        highlighted += text.substring(lastIndex);
        return highlighted;
      };

      let title = item.title;
      if (!title) {
        try {
          const urlObj = new URL(item.url);
          title = urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
        } catch (e) {
          title = item.url;
        }
      }

      const highlightedTitle = highlightText(title, 'title');
      const highlightedUrl = highlightText(item.url, 'url');
      
      // Add indentation spacer to align with folder toggles in tree view
      const spacer = document.createElement('div');
      spacer.className = 'fast-bookmark-indent';
      itemEl.appendChild(spacer);

      const favicon = document.createElement('img');
      favicon.className = 'fast-bookmark-favicon';
      setFavicon(favicon, item.url);
      itemEl.appendChild(favicon);

      const info = document.createElement('div');
      info.className = 'fast-bookmark-result-info';
      
      info.innerHTML = `
        <div class="fast-bookmark-result-header">
          <span class="fast-bookmark-result-title">${highlightedTitle}</span>
          ${item.path && settings.showPath ? `<span class="fast-bookmark-result-path">${item.path}</span>` : ''}
        </div>
        <span class="fast-bookmark-result-url">${highlightedUrl}</span>
      `;
      itemEl.appendChild(info);
      
      itemEl.addEventListener('click', (e) => {
        if (e.altKey) {
          navigator.clipboard.writeText(item.url).then(() => {
            const originalTitle = info.querySelector('.fast-bookmark-result-title').innerHTML;
            info.querySelector('.fast-bookmark-result-title').textContent = 'Copied!';
            setTimeout(() => {
              info.querySelector('.fast-bookmark-result-title').innerHTML = originalTitle;
            }, 1000);
          });
        } else {
          // Default to open in new tab for mouse click
          openBookmark(item, true);
        }
      });
      
      li.appendChild(itemEl);
      resultsList.appendChild(li);
      
      if (index === selectedIndex) {
        li.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function openBookmark(bookmark, newTab = false) {
    chrome.runtime.sendMessage({ 
      action: "openBookmark", 
      url: bookmark.url,
      newTab: newTab
    });
    toggle(false);
  }

  function toggle(force) {
    isVisible = force !== undefined ? force : !isVisible;
    if (isVisible) {
      document.body.style.overflow = 'hidden';
      loadSettings(() => {
        container.style.display = 'block';
        overlay.style.display = 'flex';
        overlay.offsetHeight;
        overlay.classList.add('visible');
        searchInput.value = '';
        results = [];
        selectedIndex = 0;
        chrome.runtime.sendMessage({ action: "getSidebarState" }, (state) => {
          const folders = state && Array.isArray(state.expandedFolders) ? state.expandedFolders : ['1','2'];
          expandedFolders = new Set(folders);
          fetchBookmarks();
          renderResults();
          const top = state && typeof state.scrollTop === 'number' ? state.scrollTop : 0;
          resultsList.scrollTop = top;
          setTimeout(() => searchInput.focus(), 50);
        });
      });
    } else {
      document.body.style.overflow = '';
      overlay.classList.remove('visible');
      setTimeout(() => {
        if (!isVisible) {
          overlay.style.display = 'none';
          container.style.display = 'none'; // Hide container
        }
      }, 200);
      container.classList.remove('fast-bookmark-searching');
    }
  }

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "toggle") {
      toggle();
    } else if (request.action === "bookmarksChanged") {
      fetchBookmarks();
    }
  });

  searchInput.addEventListener('input', (e) => {
    e.stopPropagation();
    const query = e.target.value;
    if (query) {
      if (fuse) {
        results = fuse.search(query).slice(0, 20);
      }
      container.classList.add('fast-bookmark-searching');
    } else {
      results = [];
      container.classList.remove('fast-bookmark-searching');
    }
    selectedIndex = 0;
    renderResults();
  });

  searchInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.isComposing) return;

    const displayResults = results.length > 0 ? results : bookmarks.slice(0, 10);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, displayResults.length - 1);
      renderResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderResults();
    } else if (e.key === 'Enter') {
      if (displayResults[selectedIndex]) {
        const item = displayResults[selectedIndex].item || displayResults[selectedIndex];
        openBookmark(item, e.metaKey || e.ctrlKey);
      }
    } else if (e.key === 'Escape') {
      toggle(false);
    }
  });

  searchInput.addEventListener('keypress', (e) => {
    e.stopPropagation();
  });

  searchInput.addEventListener('keyup', (e) => {
    e.stopPropagation();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      toggle(false);
    }
  });

  resultsList.addEventListener('scroll', () => {
    if (!container.classList.contains('fast-bookmark-searching')) {
      if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(() => {
        chrome.runtime.sendMessage({
          action: "saveSidebarState",
          state: { expandedFolders: Array.from(expandedFolders), scrollTop: resultsList.scrollTop }
        });
      }, 200);
    }
  });

  loadSettings();
  fetchBookmarks();
})();
