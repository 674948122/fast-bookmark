(function () {
    // Check if running in launcher mode
    const isLauncher = window.location.pathname.endsWith("launcher.html");

    // Check if script is already running in this context
    if (window.hasFastBookmarkRunning) {
        console.log("Fast Bookmark: Script already active in this context.");
        return;
    }
    window.hasFastBookmarkRunning = true;

    // Check for "Zombie" DOM from previous context (e.g. after extension update/reload)
    const existingContainer = document.getElementById("fast-bookmark-container");
    if (existingContainer && !isLauncher) {
        console.log("Fast Bookmark: Found orphan container, cleaning up...");
        existingContainer.remove();
    }

    let isVisible = false;
    let bookmarks = [];
    let folders = [];
    let bookmarkTree = [];
    let expandedFolders = new Set(["1", "2"]); // Default expand bar and other
    let fuse = null;
    let selectedIndex = -1;
    let results = [];
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    let settings = {
        theme: "auto",
        language: "auto",
        threshold: 0.2,
        showPath: true,
        showRecent: true,
        shortcut: isMac ? "meta+b" : "ctrl+b",
        panelWidth: 400,
        highlightColorLight: "#3730a3",
        highlightColorDark: "#3730a3",
        position: "right",
        sortOrder: "default",
        backgroundOpacity: 90,
        commonBookmarksLimit: 20,
        openMode: "new",
    };
    let saveSidebarStateTimer = null;
    let scrollSaveTimer = null;

    // Translation Dictionary
    const i18n = {
        en: {
            extensionName: "Fast Bookmark",
            searchPlaceholder: "Search bookmarks...",
            noMatches: "No matches found",
            noMatchesDesc: "Try a different keyword or check your spelling.",
            settingsTitle: "Fast Bookmark Settings",
            shortcutLabel: "Toggle Shortcut",
            shortcutRecording: "Recording... Press keys",
            panelWidthLabel: "Panel Width",
            highlightColorLightLabel: "Highlight Color (Light)",
            highlightColorDarkLabel: "Highlight Color (Dark)",
            highlightColorLabel: "Highlight Color",
            closeHint: "Close",
            saveButton: "Save Settings",
            editBookmarkTitle: "Edit Bookmark",
            deleteBookmarkTitle: "Delete Bookmark",
            nameLabel: "Name",
            folderLabel: "Folder",
            deleteConfirmMessage: "Are you sure you want to delete this bookmark?",
            cancelButton: "Cancel",
            deleteButton: "Delete",
            positionLabel: "Sidebar Position",
            positionLeft: "Left",
            positionRight: "Right",
            languageLabel: "Language",
            languageAuto: "Auto (System)",
            languageEn: "English",
            languageZh: "Simplified Chinese",
            wallpaperLabel: "Launcher Wallpaper",
            uploadButton: "Upload Image",
            clearButton: "Clear",
            wallpaperSizeError: "Image too large (max 4MB)",
            sortOrderLabel: "Sort Order",
            sortDefault: "Default",
            sortFrequency: "Most Visited",
            opacityLabel: "Background Opacity",
            recentFolder: "Recently Visited",
            showRecentLabel: "Show Recently Visited",
            commonFolder: "Common Bookmarks",
            showCommonLabel: "Show Common Bookmarks",
            commonBookmarksLimitLabel: "Common Bookmarks Count",
            openModeLabel: "Open Bookmarks In",
            openModeCurrent: "Current Tab",
            openModeNew: "New Tab"
        },
        zh: {
            extensionName: "悬浮书签",
            searchPlaceholder: "搜索书签...",
            noMatches: "未找到匹配项",
            noMatchesDesc: "尝试其他关键词或检查拼写。",
            settingsTitle: "悬浮书签设置",
            shortcutLabel: "切换快捷键",
            shortcutRecording: "正在录制... 请按下按键",
            panelWidthLabel: "面板宽度",
            highlightColorLightLabel: "高亮色（明亮模式）",
            highlightColorDarkLabel: "高亮色（暗黑模式）",
            highlightColorLabel: "高亮色",
            closeHint: "关闭",
            saveButton: "保存设置",
            editBookmarkTitle: "编辑书签",
            deleteBookmarkTitle: "删除书签",
            nameLabel: "名称",
            folderLabel: "文件夹",
            deleteConfirmMessage: "确定要删除此书签吗？",
            cancelButton: "取消",
            deleteButton: "删除",
            positionLabel: "侧栏位置",
            positionLeft: "左侧",
            positionRight: "右侧",
            languageLabel: "语言",
            languageAuto: "自动 (跟随系统)",
            languageEn: "English",
            languageZh: "简体中文",
            wallpaperLabel: "启动页壁纸",
            uploadButton: "上传图片",
            clearButton: "清除",
            wallpaperSizeError: "图片过大 (最大 4MB)",
            sortOrderLabel: "排序规则",
            sortDefault: "默认排序",
            sortFrequency: "根据访问频率",
            opacityLabel: "背景透明度",
            recentFolder: "最近访问",
            showRecentLabel: "显示最近访问",
            commonFolder: "常用书签",
            showCommonLabel: "显示常用书签",
            commonBookmarksLimitLabel: "常用书签数量",
            openModeLabel: "网页打开方式",
            openModeCurrent: "当前标签页",
            openModeNew: "新标签页"
        }
    };

    function getMsg(key) {
        let lang = settings.language;
        if (lang === "auto") {
            // Use chrome.i18n for auto
            return chrome.i18n.getMessage(key);
        }
        // Map "zh-CN" from chrome to "zh" in our dict, but settings stores "en" or "zh"
        // If settings.language is "zh", use i18n.zh
        return i18n[lang] && i18n[lang][key] ? i18n[lang][key] : chrome.i18n.getMessage(key);
    }

    // Create Shadow DOM container
    const container = document.createElement("div");
    container.id = "fast-bookmark-container";
    container.style.setProperty("display", "none", "important");
    container.style.setProperty("position", "fixed", "important");
    container.style.setProperty("top", "0", "important");
    container.style.setProperty("left", "0", "important");
    container.style.setProperty("z-index", "2147483647", "important");
    container.style.setProperty("visibility", "hidden", "important");
    container.style.setProperty("pointer-events", "none", "important");
    if (location.hostname && location.hostname.includes("bilibili.com")) {
        container.classList.add("custom-navbar");
    }
    document.body.appendChild(container);

    const shadow = container.attachShadow({ mode: "open" });

    // Styles
    const style = document.createElement("style");
    function getContrastColor(hexColor) {
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#333333' : '#ffffff';
    }

    function updateStyles() {
        const isDark =
            settings.theme === "dark" ||
            (settings.theme === "auto" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        
        container.setAttribute("position", settings.position || "right");

        const primaryColor = isDark ? (settings.highlightColorDark || "#3730a3") : (settings.highlightColorLight || "#3730a3");
        const primaryTextColor = getContrastColor(primaryColor);
        const opacity = (settings.backgroundOpacity !== undefined ? settings.backgroundOpacity : 90) / 100;

        style.textContent = `
      :host {
        --primary-color: ${primaryColor};
        --primary-text-color: ${primaryTextColor};
        --bg-color: ${isDark ? `rgba(17, 24, 39, ${opacity})` : `rgba(255, 255, 255, ${opacity})`};
        --text-color: ${isDark ? "#f3f4f6" : "#1f2937"};
        --secondary-text: ${isDark ? "#9ca3af" : "#6b7280"};
        --border-color: ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)"};
        --hover-bg: ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)"};
        --selected-bg: color-mix(in srgb, var(--primary-color) ${isDark ? "25%" : "15%"}, transparent);
        --shadow-lg: ${isDark ? "-20px 0 50px -10px rgba(0, 0, 0, 0.5)" : "-20px 0 50px -10px rgba(0, 0, 0, 0.15)"};
        --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --accent-color: var(--primary-color);
        --panel-width: ${settings.panelWidth || 400}px;
        --radius-md: 12px;
        --radius-sm: 8px;
        --backdrop-blur: 20px;
        
        text-align: initial;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }
      
      :host *, :host *::before, :host *::after {
        box-sizing: border-box;
      }

      /* Scrollbar */
      ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: transparent;
        border-radius: 3px;
      }
      :host(:hover) ::-webkit-scrollbar-thumb {
        background: var(--border-color);
      }
      ::-webkit-scrollbar-thumb:hover {
        background: var(--secondary-text);
      }

      #fast-bookmark-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.2); /* Lighter overlay */
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
        width: var(--panel-width);
        max-width: 90vw;
        height: 100vh;
        background: var(--bg-color);
        box-shadow: var(--shadow-lg);
        backdrop-filter: blur(var(--backdrop-blur));
        -webkit-backdrop-filter: blur(var(--backdrop-blur));
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); /* Smoother spring-like */
        position: absolute;
        top: 0;
        border-left: 1px solid var(--border-color);
      }
      
      :host([position="right"]) #fast-bookmark-modal {
        right: 0;
        left: auto;
        transform: translateX(100%);
        border-left: 1px solid var(--border-color);
        border-right: none;
      }

      :host([position="left"]) #fast-bookmark-modal {
        left: 0;
        right: auto;
        transform: translateX(-100%);
        border-right: 1px solid var(--border-color);
        border-left: none;
      }

      #fast-bookmark-overlay.visible #fast-bookmark-modal {
        transform: translateX(0);
      }

      #fast-bookmark-sidebar-header {
        padding: 24px 24px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      }

      #fast-bookmark-header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #fast-bookmark-sidebar-title {
        font-size: 20px;
        font-weight: 700;
        color: var(--text-color);
        margin: 0;
        letter-spacing: -0.02em;
      }

      .fast-bookmark-icon-btn {
        cursor: pointer;
        color: var(--secondary-text);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        width: 32px;
        height: 32px;
        border-radius: 8px;
      }

      .fast-bookmark-icon-btn:hover {
        color: var(--primary-color);
        background: var(--hover-bg);
      }

      #fast-bookmark-search-container {
        padding: 0 24px 20px;
        flex-shrink: 0;
      }

      #fast-bookmark-search-input-wrapper {
        display: flex;
        align-items: center;
        background: ${isDark ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.6)"};
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 10px 14px;
        transition: all 0.2s ease;
      }

      #fast-bookmark-search-input-wrapper:focus-within {
        background: var(--bg-color);
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, transparent);
      }

      #fast-bookmark-search-input {
        width: 100%;
        border: none;
        outline: none;
        font-size: 15px;
        color: var(--text-color);
        background: transparent;
        font-weight: 500;
      }
      
      #fast-bookmark-search-input::placeholder {
        color: var(--secondary-text);
        opacity: 0.7;
      }

      #fast-bookmark-search-icon {
        width: 18px;
        height: 18px;
        color: var(--secondary-text);
        margin-left: 8px;
        opacity: 0.8;
      }

      #fast-bookmark-clear-btn {
        width: 18px;
        height: 18px;
        color: var(--secondary-text);
        margin-left: 8px;
        cursor: pointer;
        display: none;
        transition: color 0.2s;
      }

      #fast-bookmark-clear-btn:hover {
        color: var(--text-color);
      }

      #fast-bookmark-results-list {
        flex: 1;
        overflow-y: overlay; /* Use overlay if supported */
        margin: 0;
        padding: 0 12px 24px;
        list-style: none;
      }

      .fast-bookmark-tree-node {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .fast-bookmark-result-item {
        width: 100%;
        box-sizing: border-box;
        margin: 2px 0;
        border: 1px solid transparent;
        background: transparent;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        cursor: pointer;
        transition: all 0.2s ease;
        gap: 10px;
        user-select: none;
        border-radius: var(--radius-sm);
        position: relative;
      }

      .fast-bookmark-result-item:hover {
        background: var(--hover-bg);
        border-color: var(--border-color);
        transform: translateX(4px);
        box-shadow: var(--shadow-sm);
      }

      .fast-bookmark-result-item.fast-bookmark-selected {
        background: var(--selected-bg);
        border-color: color-mix(in srgb, var(--primary-color) 30%, transparent);
      }

      .fast-bookmark-result-item:hover .fast-bookmark-actions {
        opacity: 1;
        pointer-events: auto;
      }

      .fast-bookmark-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        margin-left: auto;
      }

      .action-btn {
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        cursor: pointer;
        color: var(--secondary-text);
        transition: all 0.2s;
      }

      .action-btn:hover {
        color: var(--primary-color);
        background: rgba(0, 0, 0, 0.05);
      }
      
      :host-context([theme="dark"]) .action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .fast-bookmark-folder-toggle {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        cursor: pointer;
        transition: transform 0.2s, color 0.2s;
        color: var(--secondary-text);
        border-radius: 4px;
      }
      
      .fast-bookmark-folder-toggle:hover {
        background: var(--hover-bg);
        color: var(--text-color);
      }

      .fast-bookmark-folder-toggle.fast-bookmark-expanded {
        transform: rotate(90deg);
      }

      .fast-bookmark-folder-icon {
        color: var(--accent-color);
        display: flex;
        opacity: 0.9;
      }

      .fast-bookmark-indent {
        width: 20px; /* Matched to toggle width */
        flex-shrink: 0;
      }

      .fast-bookmark-result-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        flex-grow: 1;
        justify-content: center;
      }

      .fast-bookmark-result-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .fast-bookmark-result-path {
        font-size: 11px;
        color: var(--primary-color);
        background: color-mix(in srgb, var(--primary-color) 8%, transparent);
        padding: 1px 6px;
        border-radius: 4px;
        white-space: nowrap;
        font-weight: 500;
        display: ${settings.showPath ? "inline-block" : "none"};
        flex-shrink: 0;
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        border: 1px solid color-mix(in srgb, var(--primary-color) 15%, transparent);
      }

      .fast-bookmark-result-title {
        font-weight: 500;
        font-size: 14px;
        color: var(--text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.4;
        flex: 1;
        min-width: 0;
      }

      .fast-bookmark-result-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 1px;
        min-width: 0;
        opacity: 0.85;
      }

      .fast-bookmark-result-url {
        font-size: 12px;
        color: var(--secondary-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
      }

      .fast-bookmark-time {
        font-size: 11px;
        color: var(--secondary-text);
        white-space: nowrap;
        margin-left: 8px;
        font-variant-numeric: tabular-nums;
        opacity: 0.8;
      }

      .fast-bookmark-favicon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        border-radius: 3px;
      }

      .fast-bookmark-highlight {
        color: var(--primary-color);
        font-weight: 700;
        background: transparent; 
        /* Removed highlight background for cleaner look, just text color */
        border-bottom: 2px solid color-mix(in srgb, var(--primary-color) 30%, transparent);
        border-radius: 0;
        padding: 0;
      }

      #fast-bookmark-empty-state {
        display: none;
        flex: 1;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 12px;
        padding: 0 24px;
        text-align: center;
        color: var(--secondary-text);
      }

      #fast-bookmark-empty-state svg {
        width: 64px;
        height: 64px;
        margin-bottom: 8px;
        opacity: 0.2;
      }
      
      /* Settings Modal */
      #fast-bookmark-settings-modal, #fast-bookmark-edit-modal, #fast-bookmark-delete-modal {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        /* Remove background and backdrop-filter to use parent's */
        background: transparent;
        backdrop-filter: none;
        z-index: 100;
        display: none;
        flex-direction: column;
        padding: 0;
        animation: slideIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      .settings-scroll-container {
        flex: 1;
        overflow-y: auto;
        padding: 0 32px;
        min-height: 0;
      }
      
      #fast-bookmark-settings-modal h2 {
        padding: 32px 32px 0 32px;
        margin: 0 0 24px 0;
        flex-shrink: 0;
        font-size: 20px;
        font-weight: 700;
      }

      /* Mode classes to hide main content when modal is open */
      .mode-settings #fast-bookmark-main-view,
      .mode-edit #fast-bookmark-main-view,
      .mode-delete #fast-bookmark-main-view {
        display: none !important;
      }
      
      #fast-bookmark-main-view {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
        width: 100%;
        height: 100%;
      }

      @keyframes slideIn {
        from { transform: translateY(10px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .settings-row {
        margin-bottom: 24px;
      }

      .settings-label {
        font-weight: 600;
        font-size: 14px;
        color: var(--text-color);
        margin-bottom: 8px;
        display: block;
      }

      .form-input {
        width: 100%;
        padding: 10px 12px;
        background: var(--hover-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-color);
        font-size: 14px;
        outline: none;
        transition: all 0.2s;
      }

      .form-select {
        width: 100%;
        padding: 10px 32px 10px 12px;
        background-color: var(--hover-bg);
        /* Chevron Icon */
        background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${isDark ? "%239ca3af" : "%236b7280"}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        background-size: 10px 6px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-color);
        font-size: 14px;
        outline: none;
        appearance: none;
        -webkit-appearance: none;
        transition: all 0.2s;
        cursor: pointer;
        box-shadow: var(--shadow-sm);
      }

      .form-input:focus, .form-select:focus {
        border-color: var(--primary-color);
        background: var(--bg-color);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, transparent);
      }
      
      #shortcut-input {
        width: 100%;
        padding: 12px;
        background: var(--hover-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-color);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 14px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
      }

      #shortcut-input:hover {
        border-color: var(--primary-color);
        background: var(--bg-color);
      }

      .btn {
        padding: 10px 18px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid var(--border-color);
        background: transparent;
        color: var(--text-color);
        transition: all 0.2s;
      }

      .btn-primary {
        background: var(--primary-color);
        color: var(--primary-text-color);
        border: 1px solid transparent;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.08);
      }
      
      .btn:active {
        transform: translateY(0);
      }

      .settings-actions {
        margin-top: auto;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px;
        flex-shrink: 0;
        background: var(--bg-color);
        border-top: 1px solid var(--border-color);
      }
      
      /* Tree Lines */
      .fast-bookmark-children-container {
        position: relative;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .fast-bookmark-children-container::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        /* Adjusted for new padding/indent */
        left: calc(var(--tree-level) * 24px + 21px); 
        width: 1px;
        background-color: var(--border-color);
        opacity: 0.6;
        pointer-events: none;
      }

      /* Toggle Switch */
      .toggle-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
      }

      .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--secondary-text);
        transition: .3s;
        border-radius: 24px;
        opacity: 0.3;
      }
      
      :host-context([theme="dark"]) .toggle-slider {
        opacity: 0.5;
      }

      .toggle-slider:before {
        position: absolute;
        content: "";
        height: 20px;
        width: 20px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }

      input:checked + .toggle-slider {
        background-color: var(--primary-color);
        opacity: 1;
      }

      input:focus + .toggle-slider {
        box-shadow: 0 0 1px var(--primary-color);
      }

      input:checked + .toggle-slider:before {
        transform: translateX(20px);
      }

      /* Wallpaper Preview */
      .wallpaper-preview-container {
        width: 100%;
        height: 140px;
        background-color: var(--hover-bg);
        border: 1px dashed var(--border-color);
        border-radius: 12px;
        margin-top: 8px;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .wallpaper-preview-container:hover {
        border-color: var(--primary-color);
        background-color: var(--bg-color);
      }
      
      .wallpaper-preview-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        position: absolute;
        top: 0;
        left: 0;
        transition: transform 0.3s ease;
      }
      
      .wallpaper-preview-container:hover .wallpaper-preview-image {
        transform: scale(1.05);
      }
      
      .wallpaper-placeholder {
        color: var(--secondary-text);
        font-size: 13px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      
      .wallpaper-actions {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 8px;
        opacity: 0;
        transform: translateY(-5px);
        transition: all 0.2s ease;
        z-index: 10;
      }
      
      .wallpaper-preview-container:hover .wallpaper-actions {
        opacity: 1;
        transform: translateY(0);
      }
      
      .wallpaper-action-btn {
        width: 32px;
        height: 32px;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(4px);
        color: white;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.1);
        transition: all 0.2s;
      }
      
      .wallpaper-action-btn:hover {
        background: var(--primary-color);
        transform: scale(1.1);
      }
    `;
    }
    shadow.appendChild(style);

    // HTML Structure
    const overlay = document.createElement("div");
    overlay.id = "fast-bookmark-overlay";
    overlay.innerHTML = `
    <div id="fast-bookmark-modal">
      <div id="fast-bookmark-main-view">
        <div id="fast-bookmark-sidebar-header">
          <h2 id="fast-bookmark-sidebar-title" data-i18n="extensionName">${getMsg("extensionName")}</h2>
          <div id="fast-bookmark-header-actions">
            <div id="fast-bookmark-theme-btn" class="fast-bookmark-icon-btn" title="Theme"></div>
            <div id="fast-bookmark-config-btn" class="fast-bookmark-icon-btn" title="Settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
          </div>
        </div>
        <div id="fast-bookmark-search-container">
          <div id="fast-bookmark-search-input-wrapper">
            <input type="text" id="fast-bookmark-search-input" placeholder="${getMsg("searchPlaceholder")}" autocomplete="off">
            <svg id="fast-bookmark-clear-btn" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
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
          <div class="title" data-i18n="noMatches">${getMsg("noMatches")}</div>
          <div class="desc" data-i18n="noMatchesDesc">${getMsg("noMatchesDesc")}</div>
        </div>
      </div>
      <div id="fast-bookmark-settings-modal">
        <h2 style="color: var(--text-color);" data-i18n="settingsTitle">${getMsg("settingsTitle")}</h2>
        <div class="settings-scroll-container">
        <div class="settings-row">
          <label class="settings-label" data-i18n="languageLabel">${getMsg("languageLabel")}</label>
          <select id="language-select" class="form-select">
            <option value="auto" data-i18n="languageAuto">${getMsg("languageAuto")}</option>
            <option value="en" data-i18n="languageEn">${getMsg("languageEn")}</option>
            <option value="zh" data-i18n="languageZh">${getMsg("languageZh")}</option>
          </select>
        </div>
        <div class="settings-row" style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
          <div style="flex: 1; display: flex; align-items: center; gap: 12px;">
            <label class="toggle-switch">
              <input type="checkbox" id="show-recent-checkbox">
              <span class="toggle-slider"></span>
            </label>
            <label class="settings-label" style="margin-bottom: 0;" data-i18n="showRecentLabel">${getMsg("showRecentLabel")}</label>
          </div>
        </div>
        <div class="settings-row" style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
          <div style="flex: 1; display: flex; align-items: center; gap: 12px;">
            <label class="toggle-switch">
              <input type="checkbox" id="show-common-checkbox">
              <span class="toggle-slider"></span>
            </label>
            <label class="settings-label" style="margin-bottom: 0;" data-i18n="showCommonLabel">${getMsg("showCommonLabel")}</label>
          </div>
          <div id="common-limit-container" style="display: flex; align-items: center; gap: 8px;">
            <label class="settings-label" style="margin-bottom: 0; font-size: 13px; color: var(--secondary-text); white-space: nowrap;" data-i18n="commonBookmarksLimitLabel">${getMsg("commonBookmarksLimitLabel")}</label>
            <input type="number" id="common-bookmarks-limit" class="form-input" style="width: 60px; padding: 6px 8px; text-align: center;" min="1" max="100" value="${settings.commonBookmarksLimit || 20}">
          </div>
        </div>
        <div class="settings-row">
          <label class="settings-label" data-i18n="sortOrderLabel">${getMsg("sortOrderLabel")}</label>
          <select id="sort-order-select" class="form-select">
            <option value="default" data-i18n="sortDefault">${getMsg("sortDefault")}</option>
            <option value="frequency" data-i18n="sortFrequency">${getMsg("sortFrequency")}</option>
          </select>
        </div>
        <div class="settings-row">
          <label class="settings-label" data-i18n="shortcutLabel">${getMsg("shortcutLabel")}</label>
          <div id="shortcut-input" tabindex="0">${settings.shortcut}</div>
        </div>
        <div class="settings-row">
          <label class="settings-label" data-i18n="panelWidthLabel">${getMsg("panelWidthLabel")}</label>
          <div style="display: flex; align-items: center; gap: 12px;">
            <input type="range" id="panel-width-slider" min="300" max="800" step="10" value="${settings.panelWidth || 400}" style="flex: 1; accent-color: var(--primary-color);">
            <span id="panel-width-value" style="color: var(--text-color); font-size: 14px; min-width: 45px;">${settings.panelWidth || 400}px</span>
          </div>
        </div>
        <div class="settings-row">
          <label class="settings-label" data-i18n="opacityLabel">${getMsg("opacityLabel")}</label>
          <div style="display: flex; align-items: center; gap: 12px;">
            <input type="range" id="opacity-slider" min="0" max="100" step="1" value="${settings.backgroundOpacity !== undefined ? settings.backgroundOpacity : 90}" style="flex: 1; accent-color: var(--primary-color);">
            <span id="opacity-value" style="color: var(--text-color); font-size: 14px; min-width: 45px;">${settings.backgroundOpacity !== undefined ? settings.backgroundOpacity : 90}%</span>
          </div>
        </div>
        <div class="settings-row">
          <label class="settings-label" data-i18n="openModeLabel">${getMsg("openModeLabel")}</label>
          <div style="display: flex; gap: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-color);">
              <input type="radio" name="openMode" value="current" style="accent-color: var(--primary-color);">
              <span data-i18n="openModeCurrent">${getMsg("openModeCurrent")}</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-color);">
              <input type="radio" name="openMode" value="new" style="accent-color: var(--primary-color);">
              <span data-i18n="openModeNew">${getMsg("openModeNew")}</span>
            </label>
          </div>
        </div>
        <div class="settings-row">
          <label class="settings-label" data-i18n="positionLabel">${getMsg("positionLabel")}</label>
          <div style="display: flex; gap: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-color);">
              <input type="radio" name="position" value="left" style="accent-color: var(--primary-color);">
              <span data-i18n="positionLeft">${getMsg("positionLeft")}</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-color);">
              <input type="radio" name="position" value="right" style="accent-color: var(--primary-color);">
              <span data-i18n="positionRight">${getMsg("positionRight")}</span>
            </label>
          </div>
        </div>
        <div class="settings-row">
          <label class="settings-label" data-i18n="highlightColorLabel">${getMsg("highlightColorLabel")}</label>
          <div style="display: flex; align-items: center; gap: 24px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; color: var(--secondary-text); display: flex; align-items: center; gap: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                  <span data-i18n="themeLight">${getMsg("themeLight")}</span>
                </span>
                <input type="color" id="highlight-color-light" value="${settings.highlightColorLight || "#3730a3"}" style="cursor: pointer; width: 40px; height: 32px; padding: 0; border: 1px solid var(--border-color); border-radius: 4px; background: none;">
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; color: var(--secondary-text); display: flex; align-items: center; gap: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                  <span data-i18n="themeDark">${getMsg("themeDark")}</span>
                </span>
                <input type="color" id="highlight-color-dark" value="${settings.highlightColorDark || "#3730a3"}" style="cursor: pointer; width: 40px; height: 32px; padding: 0; border: 1px solid var(--border-color); border-radius: 4px; background: none;">
            </div>
          </div>
        </div>
        <div class="settings-row">
          <label class="settings-label" data-i18n="wallpaperLabel">${getMsg("wallpaperLabel")}</label>
          <input type="file" id="wallpaper-upload" accept="image/*" style="display: none;">
          
          <div id="wallpaper-preview-area" class="wallpaper-preview-container">
            <div id="wallpaper-placeholder-content" class="wallpaper-placeholder">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
               <span data-i18n="uploadButton">${getMsg("uploadButton")}</span>
            </div>
            <img id="wallpaper-preview-img" class="wallpaper-preview-image" style="display: none;">
            
            <div class="wallpaper-actions">
               <div id="wallpaper-remove-btn" class="wallpaper-action-btn" title="Remove">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
               </div>
            </div>
          </div>
          <div id="wallpaper-status" style="margin-top: 8px; font-size: 12px; color: var(--secondary-text);"></div>
        </div>
        </div>
        <div class="settings-actions">
          <button id="settings-cancel" class="btn" data-i18n="closeHint">${getMsg("closeHint")}</button>
          <button id="settings-save" class="btn btn-primary" data-i18n="saveButton">${getMsg("saveButton")}</button>
        </div>
      </div>
      <div id="fast-bookmark-edit-modal" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: transparent; backdrop-filter: none; z-index: 100; flex-direction: column; padding: 32px; animation: slideIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);">
        <h2 style="margin: 0 0 24px 0; color: var(--text-color);" data-i18n="editBookmarkTitle">${getMsg("editBookmarkTitle")}</h2>
        <div class="settings-scroll-container" style="padding: 0;">
        <div class="settings-row">
          <label class="settings-label" data-i18n="nameLabel">${getMsg("nameLabel")}</label>
          <input type="text" id="edit-name-input" class="form-input">
        </div>
        <div class="settings-row" id="edit-folder-row">
          <label class="settings-label" data-i18n="folderLabel">${getMsg("folderLabel")}</label>
          <select id="edit-folder-select" class="form-select"></select>
        </div>
        </div>
        <div class="settings-actions" style="padding: 24px 0 0 0; background: transparent; border: none;">
          <button id="edit-cancel" class="btn" data-i18n="cancelButton">${getMsg("cancelButton")}</button>
          <button id="edit-save" class="btn btn-primary" data-i18n="saveButton">${getMsg("saveButton")}</button>
        </div>
      </div>
      <div id="fast-bookmark-delete-modal" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: transparent; backdrop-filter: none; z-index: 100; flex-direction: column; padding: 32px; animation: slideIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);">
        <h2 style="margin: 0 0 24px 0; color: var(--text-color);" data-i18n="deleteBookmarkTitle">${getMsg("deleteBookmarkTitle")}</h2>
        <p style="color: var(--text-color); margin-bottom: 24px;font-size: 14px;" data-i18n="deleteConfirmMessage">${getMsg("deleteConfirmMessage")}</p>
        <div class="settings-actions" style="padding: 0; background: transparent; border: none;">
          <button id="delete-cancel" class="btn" data-i18n="cancelButton">${getMsg("cancelButton")}</button>
          <button id="delete-confirm" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444;" data-i18n="deleteButton">${getMsg("deleteButton")}</button>
        </div>
      </div>
    </div>
  `;
    shadow.appendChild(overlay);

    const searchInput = shadow.getElementById("fast-bookmark-search-input");
    const clearBtn = shadow.getElementById("fast-bookmark-clear-btn");
    const resultsList = shadow.getElementById("fast-bookmark-results-list");
    const emptyState = shadow.getElementById("fast-bookmark-empty-state");
    const themeBtn = shadow.getElementById("fast-bookmark-theme-btn");
    const configBtn = shadow.getElementById("fast-bookmark-config-btn");
    const settingsModal = shadow.getElementById("fast-bookmark-settings-modal");
    const languageSelect = shadow.getElementById("language-select");
    const sortOrderSelect = shadow.getElementById("sort-order-select");
    const showRecentCheckbox = shadow.getElementById("show-recent-checkbox");
    const showCommonCheckbox = shadow.getElementById("show-common-checkbox");
    const commonBookmarksLimitInput = shadow.getElementById("common-bookmarks-limit");
    const shortcutInput = shadow.getElementById("shortcut-input");
    const widthSlider = shadow.getElementById("panel-width-slider");
    const widthValue = shadow.getElementById("panel-width-value");
    const opacitySlider = shadow.getElementById("opacity-slider");
    const opacityValue = shadow.getElementById("opacity-value");
    const colorLightInput = shadow.getElementById("highlight-color-light");
    const colorDarkInput = shadow.getElementById("highlight-color-dark");
    const positionInputs = shadow.querySelectorAll('input[name="position"]');
    const openModeInputs = shadow.querySelectorAll('input[name="openMode"]');
    const saveBtn = shadow.getElementById("settings-save");
    const cancelBtn = shadow.getElementById("settings-cancel");
    
    // Wallpaper Elements
    const wallpaperUpload = shadow.getElementById("wallpaper-upload");
    const wallpaperPreviewArea = shadow.getElementById("wallpaper-preview-area");
    const wallpaperPreviewImg = shadow.getElementById("wallpaper-preview-img");
    const wallpaperRemoveBtn = shadow.getElementById("wallpaper-remove-btn");
    const wallpaperPlaceholder = shadow.getElementById("wallpaper-placeholder-content");
    const wallpaperStatus = shadow.getElementById("wallpaper-status");

    // Edit Modal Elements
    const editModal = shadow.getElementById("fast-bookmark-edit-modal");
    const editNameInput = shadow.getElementById("edit-name-input");
    const editFolderSelect = shadow.getElementById("edit-folder-select");
    const editFolderRow = shadow.getElementById("edit-folder-row");
    const editCancelBtn = shadow.getElementById("edit-cancel");
    const editSaveBtn = shadow.getElementById("edit-save");

    // Delete Modal Elements
    const deleteModal = shadow.getElementById("fast-bookmark-delete-modal");
    const deleteCancelBtn = shadow.getElementById("delete-cancel");
    const deleteConfirmBtn = shadow.getElementById("delete-confirm");

    let isRecording = false;
    let currentEditItem = null;
    let currentDeleteItem = null;
    let tempShortcut = "";

    function updateThemeToggleIcon() {
        if (!themeBtn) return;
        const isDark =
            settings.theme === "dark" ||
            (settings.theme === "auto" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        themeBtn.innerHTML = isDark
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79z"></path></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>';
    }

    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const systemDark = window.matchMedia(
                "(prefers-color-scheme: dark)",
            ).matches;
            const isDark =
                settings.theme === "dark" ||
                (settings.theme === "auto" && systemDark);
            const nextTheme = isDark ? "light" : "dark";
            chrome.storage.sync.set({ theme: nextTheme }, () => {
                settings.theme = nextTheme;
                updateStyles();
                updateThemeToggleIcon();
            });
        });
    }

    // Helper to format shortcut for display
    function formatShortcutForDisplay(shortcut) {
        if (!shortcut) return "";
        return shortcut.split("+").map(key => {
            if (key.toLowerCase() === "meta") return isMac ? "Command" : "Win";
            if (key.toLowerCase() === "ctrl") return "Ctrl";
            if (key.length === 1) return key.toUpperCase();
            return key.charAt(0).toUpperCase() + key.slice(1);
        }).join("+");
    }
    
    // Main modal container for class toggling
    const modalContainer = shadow.getElementById("fast-bookmark-modal");

    if (configBtn) {
        configBtn.addEventListener("click", () => {
            settingsModal.style.display = "flex";
            modalContainer.classList.add("mode-settings");
            
            if (languageSelect) languageSelect.value = settings.language || "auto";
            if (sortOrderSelect) sortOrderSelect.value = settings.sortOrder || "default";
            if (showRecentCheckbox) showRecentCheckbox.checked = settings.showRecent !== false; // Default true
            if (showCommonCheckbox) showCommonCheckbox.checked = settings.showCommon !== false; // Default true
            if (commonBookmarksLimitInput) commonBookmarksLimitInput.value = settings.commonBookmarksLimit || 20;
            shortcutInput.textContent = formatShortcutForDisplay(settings.shortcut);
            tempShortcut = settings.shortcut;
            widthSlider.value = settings.panelWidth || 400;
            widthValue.textContent = (settings.panelWidth || 400) + "px";
            
            const currentOpacity = settings.backgroundOpacity !== undefined ? settings.backgroundOpacity : 90;
            if (opacitySlider) opacitySlider.value = currentOpacity;
            if (opacityValue) opacityValue.textContent = currentOpacity + "%";

            if (colorLightInput) colorLightInput.value = settings.highlightColorLight || "#3730a3";
            if (colorDarkInput) colorDarkInput.value = settings.highlightColorDark || "#3730a3";
            
            positionInputs.forEach(input => {
                input.checked = input.value === (settings.position || "right");
            });

            openModeInputs.forEach(input => {
                input.checked = input.value === (settings.openMode || "new");
            });

            // Init Wallpaper UI in Settings
            initWallpaperSettings();
        });
    }

    if (widthSlider) {
        widthSlider.addEventListener("input", (e) => {
            widthValue.textContent = e.target.value + "px";
        });
    }

    if (opacitySlider) {
        opacitySlider.addEventListener("input", (e) => {
            opacityValue.textContent = e.target.value + "%";
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            settingsModal.style.display = "none";
            modalContainer.classList.remove("mode-settings");
            isRecording = false;
            shortcutInput.classList.remove("recording");
        });
    }

    // Wallpaper Logic
    let tempWallpaperData = null; // null: no change, string: new data, "remove": pending removal

    function updateWallpaperUI(dataUrl) {
        if (!wallpaperPreviewImg || !wallpaperPlaceholder || !wallpaperRemoveBtn) return;
        
        if (dataUrl) {
            wallpaperPreviewImg.src = dataUrl;
            wallpaperPreviewImg.style.display = "block";
            wallpaperPlaceholder.style.display = "none";
            wallpaperRemoveBtn.style.display = "flex";
        } else {
            wallpaperPreviewImg.src = "";
            wallpaperPreviewImg.style.display = "none";
            wallpaperPlaceholder.style.display = "flex";
            wallpaperRemoveBtn.style.display = "none";
        }
    }

    if (wallpaperPreviewArea) {
        wallpaperPreviewArea.addEventListener("click", (e) => {
             // Don't trigger upload if clicking remove button
             if (e.target.closest(".wallpaper-action-btn")) return;
             wallpaperUpload.click();
        });
    }

    if (wallpaperUpload) {
        wallpaperUpload.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 4 * 1024 * 1024) {
                alert(getMsg("wallpaperSizeError"));
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                tempWallpaperData = dataUrl;
                updateWallpaperUI(dataUrl);
            };
            reader.readAsDataURL(file);
        });
    }

    if (wallpaperRemoveBtn) {
        wallpaperRemoveBtn.addEventListener("click", (e) => {
             e.stopPropagation(); // Prevent triggering upload
             tempWallpaperData = "remove";
             updateWallpaperUI(null);
        });
    }

    // Initialize Wallpaper Settings when opening modal
    function initWallpaperSettings() {
        tempWallpaperData = null; // Reset temp state
        chrome.storage.local.get("launcherWallpaper", (result) => {
            const currentWallpaper = result.launcherWallpaper;
            updateWallpaperUI(currentWallpaper);
        });
    }
    
    // Initialize Wallpaper for actual usage (on load)
    chrome.storage.local.get("launcherWallpaper", (result) => {
        if (isLauncher && result.launcherWallpaper) {
             document.body.style.backgroundImage = `url(${result.launcherWallpaper})`;
             document.body.style.backgroundSize = "cover";
             document.body.style.backgroundPosition = "center";
             document.body.style.backgroundRepeat = "no-repeat";
             document.body.style.backgroundAttachment = "fixed";
        }
    });

    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            // Save Wallpaper Changes
            if (tempWallpaperData === "remove") {
                chrome.storage.local.remove("launcherWallpaper", () => {
                    if (isLauncher) document.body.style.backgroundImage = "";
                });
            } else if (tempWallpaperData) {
                chrome.storage.local.set({ launcherWallpaper: tempWallpaperData }, () => {
                     if (isLauncher) {
                         document.body.style.backgroundImage = `url(${tempWallpaperData})`;
                         document.body.style.backgroundSize = "cover";
                         document.body.style.backgroundPosition = "center";
                         document.body.style.backgroundRepeat = "no-repeat";
                         document.body.style.backgroundAttachment = "fixed";
                     }
                });
            }
            
            settings.shortcut = tempShortcut;
            settings.panelWidth = parseInt(widthSlider.value);
            settings.backgroundOpacity = parseInt(opacitySlider.value);
            settings.highlightColorLight = colorLightInput ? colorLightInput.value : "#3730a3";
            settings.highlightColorDark = colorDarkInput ? colorDarkInput.value : "#3730a3";
            settings.language = languageSelect ? languageSelect.value : "auto";
            settings.sortOrder = sortOrderSelect ? sortOrderSelect.value : "default";
            settings.showRecent = showRecentCheckbox ? showRecentCheckbox.checked : true;
            settings.showCommon = showCommonCheckbox ? showCommonCheckbox.checked : true;
            settings.commonBookmarksLimit = commonBookmarksLimitInput ? (parseInt(commonBookmarksLimitInput.value) || 20) : 20;
            
            let selectedPosition = "right";
            positionInputs.forEach(input => {
                if (input.checked) selectedPosition = input.value;
            });
            settings.position = selectedPosition;

            let selectedOpenMode = "new";
            openModeInputs.forEach(input => {
                if (input.checked) selectedOpenMode = input.value;
            });
            settings.openMode = selectedOpenMode;

            chrome.storage.sync.set(
                {
                    shortcut: tempShortcut,
                    panelWidth: settings.panelWidth,
                    backgroundOpacity: settings.backgroundOpacity,
                    highlightColorLight: settings.highlightColorLight,
                    highlightColorDark: settings.highlightColorDark,
                    position: settings.position,
                    openMode: settings.openMode,
                    language: settings.language,
                    sortOrder: settings.sortOrder,
                    showRecent: settings.showRecent,
                    showCommon: settings.showCommon,
                    commonBookmarksLimit: settings.commonBookmarksLimit,
                },
                () => {
                    settingsModal.style.display = "none";
                    modalContainer.classList.remove("mode-settings");
                    updateStyles();
                    updateTexts();
                    fetchBookmarks();
                },
            );
        });
    }

    function updateTexts() {
        const elements = shadow.querySelectorAll("[data-i18n]");
        elements.forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (key) {
                el.textContent = getMsg(key);
            }
        });
        
        // Also update placeholders
        if (searchInput) {
            searchInput.placeholder = getMsg("searchPlaceholder");
        }
    }

    if (languageSelect) {
        languageSelect.addEventListener("change", (e) => {
            // Temporary preview (not saved yet, but useful for user feedback)
            // Actually, for better UX let's wait for save, but we could update UI to show it works
            // But getMsg uses settings.language, so we need to temporarily set it or pass it
            // Let's just keep it simple: settings are applied on Save. 
            // BUT user expects to see the language change immediately? 
            // Standard practice in simple extensions is apply on save.
            // Let's stick to Apply on Save to avoid complex state management.
        });
    }

    if (shortcutInput) {
        shortcutInput.addEventListener("click", () => {
            isRecording = true;
            shortcutInput.classList.add("recording");
            shortcutInput.textContent = chrome.i18n.getMessage("shortcutRecording");
        });

        shortcutInput.addEventListener("keydown", (e) => {
            if (!isRecording) return;
            e.preventDefault();
            e.stopPropagation();

            const keys = [];
            if (e.metaKey) keys.push("meta");
            if (e.ctrlKey) keys.push("ctrl");
            if (e.altKey) keys.push("alt");
            if (e.shiftKey) keys.push("shift");

            // Ignore modifier keys themselves
            if (
                ["Meta", "Control", "Alt", "Shift"].includes(e.key)
            )
                return;

            const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
            keys.push(key);

            tempShortcut = keys.join("+");
            shortcutInput.textContent = formatShortcutForDisplay(tempShortcut);
            
            isRecording = false;
            shortcutInput.classList.remove("recording");
        });
    }

    function openEditModal(item, isFolder) {
        currentEditItem = item;
        editModal.style.display = "flex";
        modalContainer.classList.add("mode-edit");
        editNameInput.value = item.title;
        
        if (isFolder) {
            editFolderRow.style.display = "none";
        } else {
            editFolderRow.style.display = "block";
            // Populate folders dropdown
            editFolderSelect.innerHTML = "";
            folders.forEach(folder => {
                const option = document.createElement("option");
                option.value = folder.id;
                option.textContent = folder.title;
                if (folder.id === item.parentId) {
                    option.selected = true;
                }
                editFolderSelect.appendChild(option);
            });
        }
        editNameInput.focus();
    }

    function openDeleteModal(item, isFolder) {
        currentDeleteItem = { ...item, isFolder };
        deleteModal.style.display = "flex";
        modalContainer.classList.add("mode-delete");
    }

    // Modal Event Listeners
    if (editCancelBtn) {
        editCancelBtn.addEventListener("click", () => {
            editModal.style.display = "none";
            modalContainer.classList.remove("mode-edit");
            currentEditItem = null;
        });
    }

    if (editSaveBtn) {
        editSaveBtn.addEventListener("click", () => {
            if (!currentEditItem) return;
            
            const newTitle = editNameInput.value;
            const newParentId = editFolderSelect.value;
            
            chrome.runtime.sendMessage({
                action: "updateBookmark",
                id: currentEditItem.id,
                title: newTitle,
                parentId: currentEditItem.url ? newParentId : null, // Only move bookmarks, not folders for now (simpler)
                oldParentId: currentEditItem.parentId
            });
            
            editModal.style.display = "none";
            modalContainer.classList.remove("mode-edit");
            currentEditItem = null;
        });
    }

    if (deleteCancelBtn) {
        deleteCancelBtn.addEventListener("click", () => {
            deleteModal.style.display = "none";
            modalContainer.classList.remove("mode-delete");
            currentDeleteItem = null;
        });
    }

    if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener("click", () => {
            if (!currentDeleteItem) return;
            
            chrome.runtime.sendMessage({
                action: "deleteBookmark",
                id: currentDeleteItem.id,
                isFolder: currentDeleteItem.isFolder
            });
            
            deleteModal.style.display = "none";
            modalContainer.classList.remove("mode-delete");
            currentDeleteItem = null;
        });
    }

    // Load settings
    function loadSettings(callback) {
        chrome.storage.sync.get(
            {
                theme: "auto",
                threshold: 0.2,
                showPath: true,
        showRecent: true,
        showCommon: true,
        commonBookmarksLimit: 20,
        shortcut: isMac ? "meta+b" : "ctrl+b",
                panelWidth: 400,
                backgroundOpacity: 90,
                highlightColorLight: "#3730a3",
                highlightColorDark: "#3730a3",
                position: "right",
                language: "auto",
                sortOrder: "default",
                openMode: "new",
            },
            (items) => {
                settings = items;
                updateStyles();
                updateThemeToggleIcon();
                updateTexts(); // Apply translations
                if (callback) callback();
            },
        );
    }

    // Initialize Fuse.js
    function initFuse() {
        if (bookmarks.length > 0) {
            fuse = new Fuse(bookmarks, {
                keys: [
                    { name: "title", weight: 0.7 },
                    { name: "url", weight: 0.2 },
                    { name: "path", weight: 0.1 },
                ],
                threshold: settings.threshold,
                ignoreLocation: true,
                includeMatches: true,
                minMatchCharLength: 1,
            });
        }
    }

    function setFavicon(imgEl, pageUrl) {
        function applyInline() {
            const svg = document.createElement("svg");
            svg.setAttribute("width", "16");
            svg.setAttribute("height", "16");
            svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("fill", "currentColor");
            svg.className = "fast-bookmark-favicon";
            svg.innerHTML =
                '<path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 1v4h4"/>';
            imgEl.replaceWith(svg);
        }

        // Defensive check: if runtime context is lost, chrome.runtime will be undefined
        // or if id is missing, the URL will be invalid (chrome-extension://undefined/...)
        if (!chrome.runtime || !chrome.runtime.id) {
            applyInline();
            return;
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

            // Only attempt fallbacks for http/https URLs
            if (u.protocol === "http:" || u.protocol === "https:") {
                // First fallback: Try loading directly from the site's root
                const rootFavicon = `${u.origin}/favicon.ico`;

                imgEl.onerror = () => {
                    // Second fallback: Try Google's favicon service
                    imgEl.onerror = () => {
                        applyInline();
                    };
                    imgEl.src = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
                };
                imgEl.src = rootFavicon;
            } else {
                // For chrome:// or other internal pages, we use the inline SVG
                applyInline();
            }
        };

        imgEl.src = extUrl;
    }
    // Fetch bookmarks
    function fetchBookmarks() {
        chrome.runtime.sendMessage({ action: "getBookmarks" }, (response) => {
            // Always fetch visit counts for Common Bookmarks feature
            chrome.storage.local.get(["bookmarkVisitCounts"], (result) => {
                const counts = result.bookmarkVisitCounts || {};
                // Use recentBookmarks from response (sourced from history)
                processBookmarks(response, counts, response.recentBookmarks || []);
            });
        });
    }

    function processBookmarks(response, counts, recentUrls) {
        bookmarks = response.flattened;
        bookmarkTree = response.tree;
        folders = response.folders || [];

        // Insert Recently Visited Folder if enabled
        if (settings.showRecent !== false && recentUrls && recentUrls.length > 0) {
            // Handle both old (string[]) and new (object[]) formats
            const recentItems = recentUrls
                .map(entry => {
                    const url = typeof entry === 'string' ? entry : entry.url;
                    const timestamp = typeof entry === 'string' ? null : entry.lastVisitTime;
                    const bookmark = bookmarks.find(b => b.url === url);
                    
                    if (!bookmark) return null;
                    
                    return {
                        ...bookmark,
                        parentId: "fast-bookmark-recent",
                        lastVisitTime: timestamp
                    };
                })
                .filter(item => item); // Filter out nulls
            
            // Limit recent items to 20 (hardcoded as standard recent history limit)
            const limitedItems = recentItems.slice(0, 20);

            if (limitedItems.length > 0) {
                // Ensure we get the latest localized string
                const recentTitle = getMsg("recentFolder");
                const recentNode = {
                    id: "fast-bookmark-recent",
                    title: recentTitle,
                    children: limitedItems,
                    parentId: bookmarkTree[0] ? bookmarkTree[0].id : "root",
                    dateAdded: Date.now(),
                    index: -1
                };
                
                // Add to the top of the list
                if (bookmarkTree[0] && bookmarkTree[0].children) {
                    bookmarkTree[0].children.unshift(recentNode);
                }
            }
        }

        // Insert Common Bookmarks Folder if enabled
        if (settings.showCommon !== false) {
            const limit = settings.commonBookmarksLimit || 20;
            
            // Filter bookmarks that have visits and sort by count
            const commonItems = bookmarks
                .filter(b => counts[b.id] && counts[b.id] > 0)
                .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
                .slice(0, limit)
                .map(b => ({
                    ...b,
                    parentId: "fast-bookmark-common",
                    // Keep original path for display
                    originalPath: b.path
                }));

            if (commonItems.length > 0) {
                const commonTitle = getMsg("commonFolder");
                const commonNode = {
                    id: "fast-bookmark-common",
                    title: commonTitle,
                    children: commonItems,
                    parentId: bookmarkTree[0] ? bookmarkTree[0].id : "root",
                    dateAdded: Date.now(),
                    index: -2 // Ensure it appears before Recent if both are present? Or after?
                              // If unshift is used, last unshift appears first.
                              // Current code unshifts Recent first.
                              // So if we unshift Common NOW, Common will be at the very top.
                };

                if (bookmarkTree[0] && bookmarkTree[0].children) {
                    bookmarkTree[0].children.unshift(commonNode);
                }
            }
        }

        // Apply sorting
        if (settings.sortOrder === "frequency") {
            const weightMap = new Map();
            // Calculate weights for all nodes first
            bookmarkTree.forEach(node => calculateNodeWeight(node, counts, weightMap));
            sortBookmarkTree(bookmarkTree, weightMap);
        }

        initFuse();

        // Re-run search if there is a query to update results
        if (searchInput.value && fuse) {
            results = fuse.search(searchInput.value).slice(0, 20);
        }

        renderResults(); // Ensure UI is updated with new data
    }

    function calculateNodeWeight(node, counts, weightMap) {
        let weight = 0;
        if (!node.url) {
            // Folder: sum of children weights
            if (node.children) {
                node.children.forEach(child => {
                    weight += calculateNodeWeight(child, counts, weightMap);
                });
            }
        } else {
            // Bookmark: visit count
            weight = counts[node.id] || 0;
        }
        weightMap.set(node.id, weight);
        return weight;
    }

    function sortBookmarkTree(nodes, weightMap) {
        if (!nodes) return;
        
        nodes.forEach(node => {
            if (node.children) {
                sortBookmarkTree(node.children, weightMap);
            }
        });

        nodes.sort((a, b) => {
            const weightA = weightMap.get(a.id) || 0;
            const weightB = weightMap.get(b.id) || 0;
            
            if (weightB !== weightA) {
                return weightB - weightA;
            }
            
            // Fallback to default order (implicit) or maybe title for consistency?
            // Let's keep it stable by returning 0
            return 0;
        });
    }

    // Render results
    function renderResults() {
        resultsList.innerHTML = "";
        if (results.length === 0 && searchInput.value) {
            emptyState.style.display = "flex";
            resultsList.style.display = "none";
        } else {
            emptyState.style.display = "none";
            resultsList.style.display = "block";

            if (results.length > 0) {
                doRender(results);
            } else {
                // Show tree view when no search
                renderTreeView();
            }
        }
    }

    function renderTreeView() {
        resultsList.innerHTML = "";
        
        if (!bookmarkTree || bookmarkTree.length === 0) {
            return;
        }

        const root = bookmarkTree[0];
        const nodes = (root && root.children) ? root.children : bookmarkTree;
        
        if (!nodes) return;

        const fragment = document.createDocumentFragment();
        nodes.forEach((node) => {
            renderNode(node, fragment, 0);
        });
        resultsList.appendChild(fragment);
    }

    // Format timestamp
    function formatTime(timestamp) {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        
        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function renderNode(node, container, depth) {
        const li = document.createElement("li");
        li.className = "fast-bookmark-tree-node";

        const itemEl = document.createElement("div");
        itemEl.className = "fast-bookmark-result-item";
        itemEl.style.paddingLeft = `${depth * 24 + 12}px`;
        
        // Add data attributes for event delegation
        itemEl.dataset.id = node.id;
        itemEl.dataset.title = node.title;
        if (node.url) itemEl.dataset.url = node.url;
        if (node.parentId) itemEl.dataset.parentId = node.parentId;

        const isFolder = !!node.children;
        const isExpanded = expandedFolders.has(node.id);

        if (isFolder) {
            const toggle = document.createElement("div");
            toggle.className = `fast-bookmark-folder-toggle ${isExpanded ? "fast-bookmark-expanded" : ""}`;
            toggle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            toggle.dataset.action = "toggle"; // Mark for delegation
            itemEl.appendChild(toggle);

            const icon = document.createElement("div");
            icon.className = "fast-bookmark-folder-icon";
            
            if (node.id === "fast-bookmark-recent") {
                 // Clock/History icon
                 icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
            } else if (node.id === "fast-bookmark-common") {
                 // Star/Heart icon
                 icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            } else {
                 icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg>`;
            }
            
            itemEl.appendChild(icon);
        } else {
            // Indent for leaf nodes to align with folders that have toggles
            const spacer = document.createElement("div");
            spacer.className = "fast-bookmark-indent";
            itemEl.appendChild(spacer);

            const favicon = document.createElement("img");
            favicon.className = "fast-bookmark-favicon";
            setFavicon(favicon, node.url);
            itemEl.appendChild(favicon);
        }

        const info = document.createElement("div");
        info.className = "fast-bookmark-result-info";

        let title = node.title;
        if (!title && node.url) {
            try {
                const urlObj = new URL(node.url);
                title =
                    urlObj.hostname +
                    (urlObj.pathname !== "/" ? urlObj.pathname : "");
            } catch (e) {
                title = node.url;
            }
        }

        // Optimized layout for Special Folders (Recent/Common) to allow more space for Title
        const isSpecialFolder = (node.parentId === "fast-bookmark-recent" || node.parentId === "fast-bookmark-common");
        
        if (isSpecialFolder) {
            const showTime = node.parentId === "fast-bookmark-recent";
            const showPath = (node.originalPath || node.path);
            const displayPath = node.originalPath || node.path;
            const timeHtml = showTime ? `<span class="fast-bookmark-time">${formatTime(node.lastVisitTime)}</span>` : '';
            const pathHtml = showPath ? `<span class="fast-bookmark-result-path" title="${displayPath}">${displayPath}</span>` : '';
            
            info.innerHTML = `
                <div class="fast-bookmark-result-header">
                    <span class="fast-bookmark-result-title" title="${title || ""}">${title || "Untitled"}</span>
                    ${timeHtml}
                </div>
                <div class="fast-bookmark-result-meta">
                    ${pathHtml}
                    <span class="fast-bookmark-result-url">${node.url || ""}</span>
                </div>
            `;
        } else {
            // Standard Layout
            info.innerHTML = `<span class="fast-bookmark-result-title">${title || "Untitled"}</span>`;
        }

        itemEl.appendChild(info);

        const actions = document.createElement("div");
        actions.className = "fast-bookmark-actions";
        
        // Hide actions for the special "Recent" and "Common" folder AND their children
        // We allow opening but maybe not editing/deleting directly from these views to avoid confusion?
        // Actually, user might want to delete a bookmark from "Common" view.
        // But for "Recent" (history based), deleting might be weird if it's history item. 
        // Current code hides actions for "Recent". Let's do same for "Common" for consistency unless requested otherwise.
        if (node.id === "fast-bookmark-recent" || node.parentId === "fast-bookmark-recent" || 
            node.id === "fast-bookmark-common" || node.parentId === "fast-bookmark-common") {
            actions.style.display = "none";
        } else {
            const editBtn = document.createElement("div");
            editBtn.className = "action-btn";
            editBtn.dataset.action = "edit"; // Mark for delegation
            editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
            // Removed individual event listener
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement("div");
            deleteBtn.className = "action-btn";
            deleteBtn.dataset.action = "delete"; // Mark for delegation
            deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
            // Removed individual event listener
            actions.appendChild(deleteBtn);
        }

        itemEl.appendChild(actions);

        // Removed individual click listener on itemEl

        li.appendChild(itemEl);

        if (isFolder && isExpanded && node.children) {
            const childrenContainer = document.createElement("ul");
            childrenContainer.className = "fast-bookmark-children-container";
            childrenContainer.style.setProperty("--tree-level", depth);
            node.children.forEach((child) => {
                renderNode(child, childrenContainer, depth + 1);
            });
            li.appendChild(childrenContainer);
        }

        container.appendChild(li);
    }

    function doRender(displayResults) {
        resultsList.innerHTML = "";
        const fragment = document.createDocumentFragment();

        displayResults.forEach((result, index) => {
            const item = result.item || result;
            const li = document.createElement("li");
            li.className = "fast-bookmark-tree-node";

            const itemEl = document.createElement("div");
            itemEl.className = `fast-bookmark-result-item ${index === selectedIndex ? "fast-bookmark-selected" : ""}`;
            // Add left padding to align with root level tree nodes (12px indent)
            itemEl.style.paddingLeft = "12px";

            // Add data attributes for event delegation
            itemEl.dataset.id = item.id;
            itemEl.dataset.title = item.title;
            itemEl.dataset.url = item.url; // Search results are usually bookmarks, so url exists
            if (item.parentId) itemEl.dataset.parentId = item.parentId;

            const highlightText = (text, key) => {
                if (!result.matches) return text;
                const match = result.matches.find((m) => m.key === key);
                if (!match) return text;

                let highlighted = "";
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
                    title =
                        urlObj.hostname +
                        (urlObj.pathname !== "/" ? urlObj.pathname : "");
                } catch (e) {
                    title = item.url;
                }
            }

            const highlightedTitle = highlightText(title, "title");
            const highlightedUrl = highlightText(item.url, "url");

            // Add indentation spacer to align with folder toggles in tree view
            const spacer = document.createElement("div");
            spacer.className = "fast-bookmark-indent";
            itemEl.appendChild(spacer);

            const favicon = document.createElement("img");
            favicon.className = "fast-bookmark-favicon";
            setFavicon(favicon, item.url);
            itemEl.appendChild(favicon);

            const info = document.createElement("div");
            info.className = "fast-bookmark-result-info";

            info.innerHTML = `
        <div class="fast-bookmark-result-header">
          <span class="fast-bookmark-result-title">${highlightedTitle}</span>
        </div>
        <div class="fast-bookmark-result-meta">
          ${item.path && settings.showPath ? `<span class="fast-bookmark-result-path">${item.path}</span>` : ""}
          <span class="fast-bookmark-result-url">${highlightedUrl}</span>
        </div>
      `;
            itemEl.appendChild(info);

            const actions = document.createElement("div");
            actions.className = "fast-bookmark-actions";
            
            const editBtn = document.createElement("div");
            editBtn.className = "action-btn";
            editBtn.dataset.action = "edit";
            editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
            // Removed listener
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement("div");
            deleteBtn.className = "action-btn";
            deleteBtn.dataset.action = "delete";
            deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
            // Removed listener
            actions.appendChild(deleteBtn);

            itemEl.appendChild(actions);

            // Removed listener

            li.appendChild(itemEl);
            fragment.appendChild(li);

            if (index === selectedIndex) {
                 setTimeout(() => li.scrollIntoView({ block: "nearest" }), 0);
            }
        });
        
        resultsList.appendChild(fragment);
    }


    function openBookmark(bookmark, forceNewTab = false) {
        let newTab = settings.openMode !== "current";
        
        if (forceNewTab) {
            newTab = true;
        }

        chrome.runtime.sendMessage({
            action: "openBookmark",
            url: bookmark.url,
            id: bookmark.id,
            newTab: newTab,
        });
        toggle(false);
    }

    function toggle(force) {
        isVisible = force !== undefined ? force : !isVisible;
        if (isVisible) {
            document.body.style.overflow = "hidden";
            loadSettings(() => {
                container.style.setProperty("display", "block", "important");
                container.style.setProperty(
                    "visibility",
                    "visible",
                    "important",
                );
                container.style.setProperty(
                    "pointer-events",
                    "auto",
                    "important",
                );
                container.style.setProperty("position", "fixed", "important");
                container.style.setProperty("top", "0", "important");
                container.style.setProperty("left", "0", "important");
                container.style.setProperty(
                    "z-index",
                    "2147483647",
                    "important",
                );
                
                // Set initial position based on settings
                if (settings.position === "left") {
                    container.style.setProperty("left", "0", "important");
                    container.style.setProperty("right", "auto", "important");
                } else {
                    container.style.setProperty("right", "0", "important");
                    container.style.setProperty("left", "auto", "important");
                }

                overlay.style.display = "flex";
                overlay.offsetHeight;
                overlay.classList.add("visible");
                searchInput.value = "";
                if (typeof updateClearBtn === "function") updateClearBtn();
                results = [];
                selectedIndex = 0;
                chrome.runtime.sendMessage(
                    { action: "getSidebarState" },
                    (state) => {
                        const folders =
                            state && Array.isArray(state.expandedFolders)
                                ? state.expandedFolders
                                : ["1", "2"];
                        expandedFolders = new Set(folders);
                        fetchBookmarks();
                        renderResults();
                        const top =
                            state && typeof state.scrollTop === "number"
                                ? state.scrollTop
                                : 0;
                        resultsList.scrollTop = top;
                        setTimeout(() => searchInput.focus(), 50);
                    },
                );
            });
        } else {
            document.body.style.overflow = "";
            overlay.classList.remove("visible");
            setTimeout(() => {
                if (!isVisible) {
                    overlay.style.display = "none";
                    settingsModal.style.display = "none";
                    editModal.style.display = "none";
                    deleteModal.style.display = "none";
                    container.style.setProperty("display", "none", "important");
                    container.style.setProperty(
                        "visibility",
                        "hidden",
                        "important",
                    );
                    container.style.setProperty(
                        "pointer-events",
                        "none",
                        "important",
                    );
                    
                    // If in launcher mode, close the tab when sidebar is hidden
                    if (isLauncher) {
                        window.close();
                    }
                }
            }, 200);
            container.classList.remove("fast-bookmark-searching");
        }
    }

    if (isLauncher) {
        document.body.style.backgroundColor = "transparent"; // Ensure transparent background for launcher
        // Auto-show in launcher mode
        setTimeout(() => toggle(true), 100);
    }

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === "toggle") {
            toggle();
        } else if (request.action === "bookmarksChanged") {
            fetchBookmarks();
        }
    });

    function updateClearBtn() {
        if (searchInput.value) {
            clearBtn.style.display = "block";
        } else {
            clearBtn.style.display = "none";
        }
    }

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    const handleSearchInput = debounce((query) => {
        // Stop propagation is handled in the wrapper listener if needed
        if (query) {
            if (fuse) {
                results = fuse.search(query).slice(0, 20);
            }
            container.classList.add("fast-bookmark-searching");
        } else {
            results = [];
            container.classList.remove("fast-bookmark-searching");
        }
        selectedIndex = 0;
        renderResults();
        updateClearBtn();
    }, 150);

    searchInput.addEventListener("input", (e) => {
        e.stopPropagation();
        handleSearchInput(e.target.value);
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            searchInput.value = "";
            searchInput.focus();
            results = [];
            container.classList.remove("fast-bookmark-searching");
            selectedIndex = 0;
            renderResults();
            updateClearBtn();
        });
    }

    searchInput.addEventListener("keydown", (e) => {
        if (e.isComposing) return;

        const displayResults =
            results.length > 0 ? results : bookmarks.slice(0, 10);

        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedIndex = Math.min(
                selectedIndex + 1,
                displayResults.length - 1,
            );
            renderResults();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            renderResults();
        } else if (e.key === "Enter") {
            if (displayResults[selectedIndex]) {
                const item =
                    displayResults[selectedIndex].item ||
                    displayResults[selectedIndex];
                openBookmark(item, e.metaKey || e.ctrlKey);
            }
        } else if (e.key === "Escape") {
            toggle(false);
        }
    });

    searchInput.addEventListener("keypress", (e) => {
    });

    searchInput.addEventListener("keyup", (e) => {
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            toggle(false);
        }
    });

    resultsList.addEventListener("click", (e) => {
        const target = e.target;

        // 1. Handle Folder Toggle
        const toggleBtn = target.closest(".fast-bookmark-folder-toggle");
        if (toggleBtn) {
            e.stopPropagation();
            const itemEl = toggleBtn.closest(".fast-bookmark-result-item");
            if (itemEl) {
                const id = itemEl.dataset.id;
                if (id) {
                    if (expandedFolders.has(id)) {
                        expandedFolders.delete(id);
                    } else {
                        expandedFolders.add(id);
                    }
                    renderResults();
                    if (saveSidebarStateTimer) clearTimeout(saveSidebarStateTimer);
                    saveSidebarStateTimer = setTimeout(() => {
                        chrome.runtime.sendMessage({
                            action: "saveSidebarState",
                            state: {
                                expandedFolders: Array.from(expandedFolders),
                                scrollTop: resultsList.scrollTop,
                            },
                        });
                    }, 200);
                }
            }
            return;
        }

        // 2. Handle Action Buttons (Edit/Delete)
        const actionBtn = target.closest(".action-btn");
        if (actionBtn) {
            e.stopPropagation();
            const action = actionBtn.dataset.action;
            const itemEl = actionBtn.closest(".fast-bookmark-result-item");
            
            if (itemEl && action) {
                const id = itemEl.dataset.id;
                const title = itemEl.dataset.title;
                const url = itemEl.dataset.url;
                const parentId = itemEl.dataset.parentId;
                
                // Reconstruct item object from dataset
                const item = { id, title, url, parentId };
                const isFolder = !url; 

                if (action === "edit") {
                    openEditModal(item, isFolder);
                } else if (action === "delete") {
                    openDeleteModal(item, isFolder);
                }
            }
            return;
        }

        // 3. Handle Item Click (Open/Copy)
        const itemEl = target.closest(".fast-bookmark-result-item");
        if (itemEl) {
            const id = itemEl.dataset.id;
            const url = itemEl.dataset.url;
            
            // Check if it's a folder (if it has a toggle or no URL)
            if (!url) {
                // It's a folder
                 if (expandedFolders.has(id)) {
                    expandedFolders.delete(id);
                } else {
                    expandedFolders.add(id);
                }
                renderResults();
                if (saveSidebarStateTimer) clearTimeout(saveSidebarStateTimer);
                saveSidebarStateTimer = setTimeout(() => {
                    chrome.runtime.sendMessage({
                        action: "saveSidebarState",
                        state: {
                            expandedFolders: Array.from(expandedFolders),
                            scrollTop: resultsList.scrollTop,
                        }
                    });
                }, 200);
            } else {
                // It's a bookmark
                if (e.altKey) {
                    navigator.clipboard.writeText(url).then(() => {
                         const titleEl = itemEl.querySelector(".fast-bookmark-result-title");
                         if (titleEl) {
                             const originalTitle = titleEl.innerHTML;
                             titleEl.textContent = "Copied!";
                             setTimeout(() => {
                                 titleEl.innerHTML = originalTitle;
                             }, 1000);
                         }
                    });
                } else {
                    openBookmark({ id, url }, e.metaKey || e.ctrlKey);
                }
            }
        }
    });

    resultsList.addEventListener("scroll", () => {
        if (!container.classList.contains("fast-bookmark-searching")) {
            if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
            scrollSaveTimer = setTimeout(() => {
                chrome.runtime.sendMessage({
                    action: "saveSidebarState",
                    state: {
                        expandedFolders: Array.from(expandedFolders),
                        scrollTop: resultsList.scrollTop,
                    },
                });
            }, 200);
        }
    });

    loadSettings(() => {
        fetchBookmarks();
    });

    // Global shortcut listener
    window.addEventListener("keydown", (e) => {
        if (!settings.shortcut) return;

        const keys = settings.shortcut.split("+");
        const lastKey = keys.pop();
        const mainKey = lastKey ? lastKey.toLowerCase() : "";
        
        const ctrlRequired = keys.includes("ctrl");
        const altRequired = keys.includes("alt");
        const shiftRequired = keys.includes("shift");
        const metaRequired = keys.includes("meta");

        if (
            e.key &&
            e.key.toLowerCase() === mainKey &&
            e.ctrlKey === ctrlRequired &&
            e.altKey === altRequired &&
            e.shiftKey === shiftRequired &&
            e.metaKey === metaRequired
        ) {
            e.preventDefault();
            toggle();
        }
    });

    welcomeMsg = () => {
		let msg = '%c 💚 Something wrong? Email pandegong1992@gmail.com 💚';
		let styles = [
			'font-size: 12px',
			'color: #fffce1',
			'font-family: monospace',
			'background: #0e100f',
			'display: inline-block',
			'padding: 1rem 3rem',
			'border: 1px solid #fffce1',
			'border-radius: 4px;'
		].join(';');
		console.log(msg, styles);
	};

	welcomeMsg();
})();
