// Listen for the extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  // Ignore internal chrome pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('https://chrome.google.com/webstore')) {
    console.warn('Fast Bookmark: Cannot run on internal browser pages.');
    return;
  }

  try {
    // Try to send message first
    await chrome.tabs.sendMessage(tab.id, { action: "toggle" });
  } catch (error) {
    // If message fails, it usually means content script is not injected
    console.log('Fast Bookmark: Content script not found, injecting now...');
    
    try {
      // Dynamically inject scripts and styles
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['lib/fuse.basic.min.js', 'content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css']
      });

      // Retry message after short delay to ensure script initialization
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "toggle" }).catch(err => {
          console.error('Fast Bookmark: Failed to toggle after injection:', err);
        });
      }, 100);
    } catch (injectError) {
      console.error('Fast Bookmark: Failed to inject content script:', injectError);
    }
  }
});

// Cache for bookmarks
let cachedData = null;

function getBookmarkData(callback) {
  chrome.bookmarks.getTree((bookmarkTreeNodes) => {
    const flattenedBookmarks = [];
    const folderMap = new Map();
    
    function mapFolders(nodes) {
      nodes.forEach(node => {
        if (!node.url) {
          folderMap.set(node.id, node.title);
        }
        if (node.children) {
          mapFolders(node.children);
        }
      });
    }
    
    function flatten(nodes, path = []) {
      nodes.forEach(node => {
        if (node.url) {
          flattenedBookmarks.push({
            id: node.id,
            title: node.title,
            url: node.url,
            parentId: node.parentId,
            path: path.join(' > ')
          });
        }
        if (node.children) {
          const newPath = [...path];
          if (node.title && node.title !== 'Root') {
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
      flattened: flattenedBookmarks
    };
    
    if (callback) callback(cachedData);
  });
}

// Invalidate cache on bookmark changes
const invalidateCache = () => {
  cachedData = null;
  // Notify all tabs that bookmarks have changed
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: "bookmarksChanged" }).catch(() => {});
    });
  });
};

chrome.bookmarks.onCreated.addListener(invalidateCache);
chrome.bookmarks.onRemoved.addListener(invalidateCache);
chrome.bookmarks.onChanged.addListener(invalidateCache);
chrome.bookmarks.onMoved.addListener(invalidateCache);

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getBookmarks") {
    if (cachedData) {
      sendResponse(cachedData);
    } else {
      getBookmarkData(sendResponse);
    }
    return true;
  }
  
  if (request.action === "openBookmark") {
    // Save to recent
    chrome.storage.local.get(['recentBookmarks'], (result) => {
      let recent = result.recentBookmarks || [];
      // Remove if exists
      recent = recent.filter(url => url !== request.url);
      // Add to front
      recent.unshift(request.url);
      // Limit to 20
      recent = recent.slice(0, 20);
      chrome.storage.local.set({ recentBookmarks: recent });
    });

    if (request.newTab) {
      chrome.tabs.create({ url: request.url });
    } else {
      chrome.tabs.update({ url: request.url });
    }
  }

  if (request.action === "getRecent") {
    chrome.storage.local.get(['recentBookmarks'], (result) => {
      sendResponse(result.recentBookmarks || []);
    });
    return true;
  }
});

