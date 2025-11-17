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
                chrome.contextMenus.create({
                    id: 'prioritizeEmail',
                    title: 'Prioritás hozzáadása',
                    contexts: ['selection']
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.log('ℹ️ Context menu nem elérhető:', chrome.runtime.lastError.message);
                    } else {
                        console.log('📋 Context menu létrehozva');
                    }
                });
            });
            
            // Setup click handler (csak egyszer)
            if (!chrome.contextMenus.onClicked.hasListeners()) {
                chrome.contextMenus.onClicked.addListener((info, tab) => {
                    if (info.menuItemId === 'prioritizeEmail') {
                        chrome.action.openPopup().catch(() => {
                            console.log('ℹ️ Popup nem nyitható meg programmatically');
                        });
                    }
                });
            }
        }
    } catch (error) {
        console.log('ℹ️ Context menu nem támogatott:', error.message);
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