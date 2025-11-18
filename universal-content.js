// Universal Content Script - Works on ANY webpage
console.log('🌐 Universal Prioritizer loaded on:', window.location.href);

// Storage key for web links
const WEBLINKS_STORAGE_KEY = 'webLinkPriorities';

// Get current page data
function getCurrentPageData() {
    const url = window.location.href;
    const title = document.title || 'Untitled Page';
    
    // JIRA specific: try to get issue summary from h1#summary-val
    const jiraSummary = document.querySelector('h1#summary-val');
    if (jiraSummary) {
        const summaryText = jiraSummary.textContent.trim();
        // Remove the edit icon text if present
        const cleanSummary = summaryText.replace(/Click to edit/g, '').trim();
        if (cleanSummary) {
            console.log('📋 JIRA summary found:', cleanSummary);
            return {
                url: url,
                title: cleanSummary,
                hostname: window.location.hostname
            };
        }
    }
    
    // Try to find better title from page headers
    const selectors = [
        'h1#summary-val',  // JIRA summary
        'h1',
        '[class*="page-header"] h1',
        '[class*="page-title"]',
        '[class*="issue-link"]',
        'title'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
            const text = element.textContent.trim().replace(/Click to edit/g, '').trim();
            if (text) {
                return {
                    url: url,
                    title: text,
                    hostname: window.location.hostname
                };
            }
        }
    }
    
    return {
        url: url,
        title: title,
        hostname: window.location.hostname
    };
}

// Add badge to page
function addPageBadge(importance, urgency) {
    // Remove existing badge
    const existing = document.querySelector('.eisenhower-page-badge');
    if (existing) {
        existing.remove();
    }
    
    // Determine category and colors
    let color, borderColor, category, icon;
    
    if (importance >= 3 && urgency >= 3) {
        color = '#ffe6e6';
        borderColor = '#ff4444';
        category = 'Do First';
        icon = '🔴';
    } else if (importance >= 3 && urgency < 3) {
        color = '#fff9e6';
        borderColor = '#ffb84d';
        category = 'Schedule';
        icon = '🟡';
    } else if (importance < 3 && urgency >= 3) {
        color = '#e6f3ff';
        borderColor = '#4499ff';
        category = 'Delegate';
        icon = '🔵';
    } else {
        color = '#e6ffe6';
        borderColor = '#44bb44';
        category = 'Eliminate';
        icon = '🟢';
    }
    
    // Find best insertion point
    const insertionSelectors = [
        // JIRA specific
        '.aui-page-header-main h1',
        '.aui-page-header-main',
        // Generic
        'h1',
        '[role="main"] h1',
        '[class*="page-header"]',
        'header h1',
        'body'
    ];
    
    let targetElement = null;
    for (const selector of insertionSelectors) {
        targetElement = document.querySelector(selector);
        if (targetElement) {
            console.log('🎯 Badge insertion point:', selector);
            break;
        }
    }
    
    if (!targetElement) {
        console.warn('⚠️ No suitable element found for badge');
        return;
    }
    
    // Create badge
    const badge = document.createElement('div');
    badge.className = 'eisenhower-page-badge';
    badge.innerHTML = `
        <span class="badge-icon">${icon}</span>
        <span class="badge-text">${category}</span>
        <span class="badge-meta">F: ${importance}/4 | S: ${urgency}/4</span>
    `;
    
    // Style the badge
    Object.assign(badge.style, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        marginLeft: '12px',
        background: `linear-gradient(135deg, ${color} 0%, ${borderColor}25 100%)`,
        border: `2px solid ${borderColor}`,
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '600',
        color: borderColor,
        verticalAlign: 'middle',
        animation: 'badgeFadeIn 0.3s ease',
        boxShadow: `0 2px 8px ${borderColor}40`,
        zIndex: '9999'
    });
    
    // Add animation styles if not exist
    if (!document.getElementById('eisenhower-universal-styles')) {
        const style = document.createElement('style');
        style.id = 'eisenhower-universal-styles';
        style.textContent = `
            @keyframes badgeFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            .eisenhower-page-badge .badge-icon {
                font-size: 16px;
                line-height: 1;
            }
            .eisenhower-page-badge .badge-text {
                font-weight: 700;
            }
            .eisenhower-page-badge .badge-meta {
                font-size: 11px;
                opacity: 0.8;
                margin-left: 4px;
                padding-left: 8px;
                border-left: 1px solid currentColor;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Insert badge
    if (targetElement.tagName === 'H1') {
        // If it's an h1, append after it
        targetElement.insertAdjacentElement('afterend', badge);
    } else {
        // Otherwise append inside
        targetElement.appendChild(badge);
    }
    
    console.log('✅ Page badge added:', category);
}

// Check if current page is already prioritized
function checkAndDisplayBadge() {
    const currentUrl = window.location.href;
    
    chrome.storage.local.get([WEBLINKS_STORAGE_KEY], (result) => {
        const webLinks = result[WEBLINKS_STORAGE_KEY] || {};
        
        // Find matching URL
        for (const [storedUrl, data] of Object.entries(webLinks)) {
            if (storedUrl === currentUrl) {
                console.log('📌 Found existing priority for this page:', data);
                addPageBadge(data.importance, data.urgency);
                break;
            }
        }
    });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'categorizeWebPage') {
        console.log('🌐 Web page categorization:', request);
        
        const pageData = getCurrentPageData();
        
        const priorityData = {
            url: pageData.url,
            title: pageData.title,
            hostname: pageData.hostname,
            importance: request.importance,
            urgency: request.urgency,
            timestamp: Date.now()
        };
        
        // Save to storage
        chrome.storage.local.get([WEBLINKS_STORAGE_KEY], (result) => {
            const webLinks = result[WEBLINKS_STORAGE_KEY] || {};
            webLinks[pageData.url] = priorityData;
            
            chrome.storage.local.set({ [WEBLINKS_STORAGE_KEY]: webLinks }, () => {
                console.log('✅ Web page priority saved:', priorityData);
                
                // Add badge to page
                addPageBadge(request.importance, request.urgency);
                
                // Show notification
                showNotification(`✅ Oldal hozzáadva: ${getCategoryName(request.importance, request.urgency)}`);
                
                sendResponse({ success: true, data: priorityData });
            });
        });
        
        return true; // Async response
    }
    
    if (request.action === 'removeWebPagePriority') {
        const currentUrl = window.location.href;
        
        chrome.storage.local.get([WEBLINKS_STORAGE_KEY], (result) => {
            const webLinks = result[WEBLINKS_STORAGE_KEY] || {};
            delete webLinks[currentUrl];
            
            chrome.storage.local.set({ [WEBLINKS_STORAGE_KEY]: webLinks }, () => {
                // Remove badge
                const badge = document.querySelector('.eisenhower-page-badge');
                if (badge) badge.remove();
                
                showNotification('✅ Prioritás eltávolítva');
                sendResponse({ success: true });
            });
        });
        
        return true;
    }
});

// Helper: Get category name
function getCategoryName(importance, urgency) {
    const categoryNames = {
        '4-4': '🔴 Do First',
        '4-2': '🟡 Schedule',
        '2-4': '🔵 Delegate',
        '2-2': '🟢 Eliminate'
    };
    const key = `${importance}-${urgency}`;
    return categoryNames[key] || 'kategória';
}

// Show in-page notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 0.3s ease-out;
        min-width: 200px;
        text-align: center;
    `;
    notification.textContent = message;
    
    // Add animation keyframes if not already added
    if (!document.getElementById('notification-styles-universal')) {
        const style = document.createElement('style');
        style.id = 'notification-styles-universal';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Track current URL for change detection
let lastUrl = window.location.href;

// Check on page load
checkAndDisplayBadge();

// Monitor URL changes (for SPA navigation like JIRA)
function onUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        console.log('🔄 URL changed:', lastUrl, '→', currentUrl);
        lastUrl = currentUrl;
        
        // Remove old badge
        const oldBadge = document.querySelector('.eisenhower-page-badge');
        if (oldBadge) {
            oldBadge.remove();
        }
        
        // Check and display badge for new URL
        setTimeout(() => {
            checkAndDisplayBadge();
        }, 500); // Small delay for DOM to update
    }
}

// Listen for history API changes (SPA navigation)
window.addEventListener('popstate', onUrlChange);

// Override pushState and replaceState to detect SPA navigation
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
    originalPushState.apply(this, args);
    onUrlChange();
};

history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    onUrlChange();
};

// Monitor DOM changes for dynamic content (JIRA issue key changes)
const urlObserver = new MutationObserver(() => {
    onUrlChange();
});

// Observe body for changes (JIRA updates URL without full page reload)
if (document.body) {
    urlObserver.observe(document.body, {
        childList: true,
        subtree: false
    });
}

console.log('✅ Universal Prioritizer ready');
