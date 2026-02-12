// Helper to send message with retry
async function sendMessageWithRetry(tabId, message, maxRetries = 10, interval = 100) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await chrome.tabs.sendMessage(tabId, message);
            return; // Success
        } catch (error) {
            if (i === maxRetries - 1) {
                console.error("Fast Bookmark: Failed to send message after retries:", error);
                throw error;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
}

// Listen for the extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    // Check for internal chrome pages or other restricted pages
    const launcherUrl = chrome.runtime.getURL("launcher.html");
    if (
        (
            tab.url.startsWith("chrome://") ||
            tab.url.startsWith("edge://") ||
            tab.url.startsWith("https://chrome.google.com/webstore") ||
            tab.url.startsWith("https://chromewebstore.google.com") ||
            tab.url.startsWith("about:") ||
            tab.url.startsWith("chrome-extension://")
        ) && tab.url !== launcherUrl
    ) {
        console.log("Fast Bookmark: Restricted page detected, opening launcher tab.");
        chrome.tabs.create({ url: launcherUrl });
        return;
    }

    // Request optional permissions before loading
    const permissionsToRequest = {
        permissions: ["bookmarks", "favicon"],
    };

    try {
        const hasPermission =
            await chrome.permissions.contains(permissionsToRequest);
        if (!hasPermission) {
            const granted =
                await chrome.permissions.request(permissionsToRequest);
            if (!granted) {
                console.warn("Fast Bookmark: Permissions not granted.");
                return;
            }
            // Permissions just granted, set up listeners
            setupBookmarkListeners();
        }

        // Try to send message first
        await chrome.tabs.sendMessage(tab.id, { action: "toggle" });
    } catch (error) {
        // If message fails, it usually means content script is not injected
        console.log(
            "Fast Bookmark: Content script not found, injecting now...",
        );

        try {
            // Dynamically inject scripts and styles
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["lib/fuse.basic.min.js", "content.js"],
            });

            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ["styles.css"],
            });

            // Retry message after short delay to ensure script initialization
            // Use retry logic instead of single timeout
            await sendMessageWithRetry(tab.id, { action: "toggle" });
        } catch (injectError) {
            // Handle cases where content script cannot be injected (e.g., error pages, restricted domains)
            if (injectError.message && (
                injectError.message.includes("Frame with ID 0 is showing error page") ||
                injectError.message.includes("The extensions gallery cannot be scripted")
            )) {
                console.warn("Fast Bookmark: Cannot inject into restricted page, opening launcher instead.");
                chrome.tabs.create({ url: chrome.runtime.getURL("launcher.html") });
                return;
            }

            console.error(
                "Fast Bookmark: Failed to inject content script:",
                injectError,
            );
        }
    }
});

// Cache for bookmarks
let cachedData = null;

function getBookmarkData(callback) {
    if (!chrome.bookmarks) {
        console.warn("Fast Bookmark: Bookmarks permission not granted.");
        if (callback) callback({ tree: [], flattened: [] });
        return;
    }
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        const flattenedBookmarks = [];
        const folders = [];
        const folderMap = new Map();

        function mapFolders(nodes) {
            nodes.forEach((node) => {
                if (!node.url) {
                    folderMap.set(node.id, node.title);
                    folders.push({ id: node.id, title: node.title });
                }
                if (node.children) {
                    mapFolders(node.children);
                }
            });
        }

        function flatten(nodes, path = []) {
            nodes.forEach((node) => {
                if (node.url) {
                    flattenedBookmarks.push({
                        id: node.id,
                        title: node.title,
                        url: node.url,
                        parentId: node.parentId,
                        path: path.join(" > "),
                    });
                }
                if (node.children) {
                    const newPath = [...path];
                    if (node.title && node.title !== "Root") {
                        newPath.push(node.title);
                    }
                    flatten(node.children, newPath);
                }
            });
        }

        mapFolders(bookmarkTreeNodes);
        flatten(bookmarkTreeNodes);

        cachedData = {
            tree: bookmarkTreeNodes,
            flattened: flattenedBookmarks,
            folders: folders,
        };

        if (callback) callback(cachedData);
    });
}

// Invalidate cache on bookmark changes
const invalidateCache = () => {
    cachedData = null;
    // Notify all tabs that bookmarks have changed
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            chrome.tabs
                .sendMessage(tab.id, { action: "bookmarksChanged" })
                .catch(() => {});
        });
    });
};

function setupBookmarkListeners() {
    if (
        chrome.bookmarks &&
        !chrome.bookmarks.onCreated.hasListener(invalidateCache)
    ) {
        chrome.bookmarks.onCreated.addListener(invalidateCache);
        chrome.bookmarks.onRemoved.addListener(invalidateCache);
        chrome.bookmarks.onChanged.addListener(invalidateCache);
        chrome.bookmarks.onMoved.addListener(invalidateCache);
    }
}

// Initial setup if permissions are already granted
chrome.permissions.contains(
    { permissions: ["bookmarks", "favicon"] },
    (result) => {
        if (result) {
            setupBookmarkListeners();
        }
    },
);

// Initialization: Migrate old recentBookmarks format if necessary
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["recentBookmarks"], (result) => {
        let recent = result.recentBookmarks || [];
        if (recent.length > 0 && typeof recent[0] === 'string') {
            console.log("Fast Bookmark: Migrating recent bookmarks to new format...");
            // Use current time as fallback so they are not empty
            recent = recent.map(url => ({ url, lastVisitTime: Date.now() }));
            chrome.storage.local.set({ recentBookmarks: recent });
        }
    });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getBookmarks") {
        const getRecentHistory = async () => {
            if (!chrome.history) return [];
            
            // Search history for recent items
            const historyItems = await chrome.history.search({ 
                text: '', 
                maxResults: 2000, // Optimized limit (enough to find 20 recent bookmarks)
                startTime: Date.now() - 90 * 24 * 60 * 60 * 1000 // Last 90 days
            });

            return historyItems.map(item => ({
                url: item.url,
                lastVisitTime: item.lastVisitTime
            }));
        };

        const sendData = async () => {
            let data;
            if (cachedData) {
                data = cachedData;
            } else {
                data = await new Promise(resolve => getBookmarkData(resolve));
            }
            
            // Fetch recent history
            const historyItems = await getRecentHistory();
            
            // Helper to normalize URLs (strip trailing slash) for better matching
            const normalizeUrl = (url) => {
                try {
                    return url.replace(/\/$/, '');
                } catch (e) {
                    return url;
                }
            };

            // Filter history to find items that are actually bookmarks
            // Create a Set of bookmark URLs for O(1) lookup
            const bookmarkUrls = new Set(data.flattened.map(b => normalizeUrl(b.url)));
            
            const recentBookmarks = historyItems
                .filter(item => bookmarkUrls.has(normalizeUrl(item.url)));
                // .slice(0, 20); // Removed slice, let frontend handle limit

            sendResponse({
                ...data,
                recentBookmarks
            });
        };

        sendData();
        return true; // Keep channel open for async response
    }

    if (request.action === "openBookmark") {
        // Track visit count
        if (request.id) {
            chrome.storage.local.get(["bookmarkVisitCounts"], (result) => {
                const counts = result.bookmarkVisitCounts || {};
                counts[request.id] = (counts[request.id] || 0) + 1;
                chrome.storage.local.set({ bookmarkVisitCounts: counts });
            });
        }
        
        // No longer manually tracking recentBookmarks since we use chrome.history

        const isLauncher = sender.tab && sender.tab.url && sender.tab.url.endsWith("launcher.html");

        if (request.newTab || (isLauncher && !request.newTab)) {
            chrome.tabs.create({ url: request.url });
        } else {
            chrome.tabs.update({ url: request.url });
        }
    }

    if (request.action === "getRecent") {
        chrome.storage.local.get(["recentBookmarks"], (result) => {
            sendResponse(result.recentBookmarks || []);
        });
        return true;
    }

    if (request.action === "getSidebarState") {
        chrome.storage.local.get(["sidebarState"], (result) => {
            const state = result.sidebarState || {
                expandedFolders: ["1", "2"],
                scrollTop: 0,
            };
            sendResponse(state);
        });
        return true;
    }

    if (request.action === "saveSidebarState") {
        chrome.storage.local.set({ sidebarState: request.state });
    }

    if (request.action === "deleteBookmark") {
        if (request.isFolder) {
            chrome.bookmarks.removeTree(request.id);
        } else {
            chrome.bookmarks.remove(request.id);
        }
        return true;
    }

    if (request.action === "updateBookmark") {
        chrome.bookmarks.update(request.id, { title: request.title }, () => {
            if (request.parentId && request.parentId !== request.oldParentId) {
                chrome.bookmarks.move(request.id, { parentId: request.parentId });
            }
        });
        return true;
    }
});
