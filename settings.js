// Settings page logic
console.log('⚙️ Settings oldal betöltve');

let customUrls = [];

// Load saved URLs
function loadSettings() {
    chrome.storage.local.get(['customExchangeUrls'], (result) => {
        customUrls = result.customExchangeUrls || [];
        renderUrlList();
        console.log('📋 Betöltött URL-ek:', customUrls);
    });
}

// Render URL list
function renderUrlList() {
    const urlList = document.getElementById('urlList');
    
    if (customUrls.length === 0) {
        urlList.innerHTML = '<p style="color: #999; font-size: 13px;">Nincs egyedi URL hozzáadva</p>';
        return;
    }
    
    urlList.innerHTML = '';
    
    customUrls.forEach((url, index) => {
        const item = document.createElement('div');
        item.className = 'url-item';
        item.innerHTML = `
            <code>${url}</code>
            <button class="remove-btn" data-index="${index}">Törlés</button>
        `;
        urlList.appendChild(item);
    });
    
    // Add remove handlers
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            removeUrl(index);
        });
    });
}

// Add URL
function addUrl() {
    const input = document.getElementById('newUrl');
    const url = input.value.trim();
    
    if (!url) {
        showStatus('Adj meg egy URL-t!', 'error');
        return;
    }
    
    // Validate URL format
    try {
        const urlObj = new URL(url);
        const cleanUrl = `${urlObj.protocol}//${urlObj.hostname}`;
        
        if (customUrls.includes(cleanUrl)) {
            showStatus('Ez az URL már hozzá van adva!', 'error');
            return;
        }
        
        customUrls.push(cleanUrl);
        input.value = '';
        renderUrlList();
        showStatus('URL hozzáadva! Ne felejts el menteni!', 'success');
        
    } catch (e) {
        showStatus('Érvénytelen URL formátum! Használj https:// vagy http:// előtagot.', 'error');
    }
}

// Remove URL
function removeUrl(index) {
    customUrls.splice(index, 1);
    renderUrlList();
    showStatus('URL eltávolítva! Ne felejts el menteni!', 'success');
}

// Save settings
function saveSettings() {
    chrome.storage.local.set({ customExchangeUrls: customUrls }, () => {
        showStatus('✅ Beállítások mentve! Töltsd újra az extensiont (chrome://extensions)', 'success');
        console.log('💾 URL-ek mentve:', customUrls);
        
        // Update content script permissions dynamically
        updateContentScriptPermissions();
    });
}

// Update content script permissions
function updateContentScriptPermissions() {
    // This requires reloading the extension, so we just save the data
    // The background script will handle applying these URLs on next load
    console.log('ℹ️ Töltsd újra az extensiont a chrome://extensions oldalon a változások életbe lépéséhez');
}

// Show status message
function showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 5000);
}

// Event listeners
document.getElementById('addUrlBtn').addEventListener('click', addUrl);
document.getElementById('saveBtn').addEventListener('click', saveSettings);

// Allow Enter key to add URL
document.getElementById('newUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addUrl();
    }
});

// Load settings on page load
loadSettings();
