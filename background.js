// Background service worker
console.log('🚀 Exchange Prioritizer Background Service Worker inicializálva');

// Installation handler
chrome.runtime.onInstalled.addListener((details) => {
    console.log('✅ Exchange Prioritizer kiegészítő telepítve!');
    
    if (details.reason === 'install') {
        // Első telepítés
        chrome.storage.sync.set({
            autoCategorize: false,
            exchangeUrl: ''
        });
        
        console.log('📦 Alapértelmezett beállítások inicializálva');
        
        // Üdvözlő értesítés (opcionális, ha hozzáadod a notifications permissiont)
        // chrome.notifications.create({
        //     type: 'basic',
        //     iconUrl: 'icons/icon128.png',
        //     title: 'Exchange Prioritizer',
        //     message: 'Sikeresen telepítve! Kattints az ikonra a kezdéshez.'
        // });
        
    } else if (details.reason === 'update') {
        console.log(`🔄 Frissítve: ${details.previousVersion} -> ${chrome.runtime.getManifest().version}`);
    }
    
    // Context menu létrehozása
    setupContextMenu();
});

// Setup context menu (safe to call multiple times)
function setupContextMenu() {
    try {
        if (chrome.contextMenus) {
            chrome.contextMenus.removeAll(() => {
                // Parent menu
                chrome.contextMenus.create({
                    id: 'eisenhowerMatrix',
                    title: 'Eisenhower Mátrix',
                    contexts: ['page', 'selection']
                });
                
                // Submenu items for each quadrant
                chrome.contextMenus.create({
                    id: 'matrix-do-first',
                    parentId: 'eisenhowerMatrix',
                    title: '🔴 Do First (Fontos & Sürgős)',
                    contexts: ['page', 'selection']
                });
                
                chrome.contextMenus.create({
                    id: 'matrix-schedule',
                    parentId: 'eisenhowerMatrix',
                    title: '🟡 Schedule (Fontos & Nem Sürgős)',
                    contexts: ['page', 'selection']
                });
                
                chrome.contextMenus.create({
                    id: 'matrix-delegate',
                    parentId: 'eisenhowerMatrix',
                    title: '🔵 Delegate (Nem Fontos & Sürgős)',
                    contexts: ['page', 'selection']
                });
                
                chrome.contextMenus.create({
                    id: 'matrix-eliminate',
                    parentId: 'eisenhowerMatrix',
                    title: '🟢 Eliminate (Nem Fontos & Nem Sürgős)',
                    contexts: ['page', 'selection']
                });
                
                // Separator
                chrome.contextMenus.create({
                    id: 'separator',
                    parentId: 'eisenhowerMatrix',
                    type: 'separator',
                    contexts: ['page', 'selection']
                });
                
                // Open popup option
                chrome.contextMenus.create({
                    id: 'open-popup',
                    parentId: 'eisenhowerMatrix',
                    title: '⚙️ Mátrix megnyitása',
                    contexts: ['page', 'selection']
                });
                
                console.log('📋 Context menu létrehozva (4 kategória)');
            });
            
            // Setup click handler (csak egyszer)
            if (!chrome.contextMenus.onClicked.hasListeners()) {
                chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
            }
        }
    } catch (error) {
        console.log('ℹ️ Context menu nem támogatott:', error.message);
    }
}

// Handle context menu clicks
function handleContextMenuClick(info, tab) {
    console.log('🖱️ Context menu click:', info.menuItemId, 'on', tab.url);
    console.log('   Tab ID:', tab.id, 'Tab status:', tab.status);
    
    // Map menu ID to importance and urgency
    const categoryMap = {
        'matrix-do-first': { importance: 4, urgency: 4 },
        'matrix-schedule': { importance: 4, urgency: 2 },
        'matrix-delegate': { importance: 2, urgency: 4 },
        'matrix-eliminate': { importance: 2, urgency: 2 }
    };
    
    if (info.menuItemId === 'open-popup') {
        // Try to open popup
        chrome.action.openPopup().catch(() => {
            console.log('ℹ️ Popup megnyitás nem sikerült - felhasználónak kell kattintania az ikonra');
        });
        return;
    }
    
    const category = categoryMap[info.menuItemId];
    if (category && tab) {
        // Check if we're on an OWA/Exchange page
        const owaHosts = ['xch.ulyssys.hu', 'outlook.office365.com', 'outlook.office.com', 'outlook.live.com'];
        const isOWA = owaHosts.some(host => tab.url.includes(host));
        
        // Helper function to send message with retry
        const sendMessageWithRetry = (message, maxRetries = 2) => {
            let attempts = 0;
            
            const attemptSend = () => {
                attempts++;
                console.log(`   Attempt ${attempts}/${maxRetries + 1} to send message to tab ${tab.id}`);
                
                chrome.tabs.sendMessage(tab.id, message, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn(`   ⚠️ Attempt ${attempts} failed:`, chrome.runtime.lastError.message);
                        
                        if (attempts <= maxRetries) {
                            console.log(`   🔄 Retrying in 300ms...`);
                            setTimeout(attemptSend, 300);
                        } else {
                            console.error('❌ All retry attempts failed. Content script may not be loaded.');
                            // Show user notification
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'icon48.png',
                                title: 'Eisenhower Matrix',
                                message: 'Nem sikerült kategorizálni az oldalt. Próbáld újratölteni az oldalt (F5).'
                            });
                        }
                    } else if (response && response.success) {
                        console.log('✅ Successfully categorized:', isOWA ? 'email' : 'web page');
                        console.log('   Response:', response);
                    } else {
                        console.warn('⚠️ Unexpected response:', response);
                    }
                });
            };
            
            attemptSend();
        };
        
        if (isOWA) {
            // OWA - categorize email
            console.log('   Detected OWA page - sending email categorization');
            sendMessageWithRetry({
                action: 'categorizeFromContextMenu',
                importance: category.importance,
                urgency: category.urgency
            });
        } else {
            // Universal - categorize web page
            console.log('   Detected non-OWA page - sending web page categorization');
            sendMessageWithRetry({
                action: 'categorizeWebPage',
                importance: category.importance,
                urgency: category.urgency
            });
        }
    }
}

// Periodic sync for data cleanup
chrome.alarms.create('periodicCleanup', { periodInMinutes: 1440 }); // 24 órás cleanup

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'periodicCleanup') {
        console.log('⏰ Periodikus tisztítás futott');
        cleanupOldData();
    }
});

// Clean up data older than 30 days
function cleanupOldData() {
    chrome.storage.local.get(['emailPriorities'], (result) => {
        if (!result.emailPriorities) return;
        
        const priorities = result.emailPriorities;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        let cleaned = 0;
        Object.entries(priorities).forEach(([id, data]) => {
            const timestamp = new Date(data.timestamp);
            if (timestamp < thirtyDaysAgo) {
                delete priorities[id];
                cleaned++;
            }
        });
        
        if (cleaned > 0) {
            chrome.storage.local.set({ emailPriorities: priorities });
            console.log(`🧹 ${cleaned} régi bejegyzés törölve`);
        }
    });
}

// Message handling from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Üzenet érkezett:', request.action);
    
    switch (request.action) {
        case 'getPriorities':
            chrome.storage.local.get(['emailPriorities'], (result) => {
                sendResponse({ priorities: result.emailPriorities || {} });
            });
            return true; // async response
            
        case 'savePriority':
            // Ez már a content-script kezeli, de itt is logolhatjuk
            console.log('💾 Prioritás mentési kérés:', request);
            break;
            
        case 'exportData':
            chrome.storage.local.get(['emailPriorities'], (result) => {
                sendResponse({ data: result.emailPriorities || {} });
            });
            return true;
            
        default:
            console.log('⚠️ Ismeretlen action:', request.action);
    }
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('❌ Service Worker hiba:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Promise rejection:', event.reason);
});

console.log('✅ Background service worker teljesen betöltve');