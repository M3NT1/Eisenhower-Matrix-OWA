// Popup Script - Exchange Prioritizer
console.log('🎯 Popup betöltve');

// Tab management
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(tabName).classList.add('active');
        
        if (tabName === 'matrix') {
            refreshMatrix();
        }
    });
});

let selectedImportance = 0;
let selectedUrgency = 0;

// Importance buttons
document.querySelectorAll('.importance-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.importance-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedImportance = parseInt(btn.dataset.level);
        updateCategoryResult();
    });
});

// Urgency buttons
document.querySelectorAll('.urgency-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.urgency-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedUrgency = parseInt(btn.dataset.level);
        updateCategoryResult();
    });
});

// Calculate category
function updateCategoryResult() {
    const categoryP = document.getElementById('category-result');
    
    if (selectedImportance === 0 || selectedUrgency === 0) {
        categoryP.textContent = '--';
        categoryP.style.color = '#999';
        return;
    }
    
    let category = '';
    let color = '';
    
    if (selectedImportance >= 3 && selectedUrgency >= 3) {
        category = '🔴 Do First (Cselekedj azonnal)';
        color = '#ff4444';
    } else if (selectedImportance >= 3 && selectedUrgency < 3) {
        category = '🟡 Schedule (Ütemezd)';
        color = '#ffb84d';
    } else if (selectedImportance < 3 && selectedUrgency >= 3) {
        category = '🔵 Delegate (Delegálj)';
        color = '#4499ff';
    } else {
        category = '🟢 Eliminate (Távolítsd el)';
        color = '#44bb44';
    }
    
    categoryP.textContent = category;
    categoryP.style.color = color;
}

// Save priority with better error handling
document.getElementById('save-priority').addEventListener('click', async () => {
    if (selectedImportance === 0 || selectedUrgency === 0) {
        showNotification('⚠️ Kérlek válassz fontosságot és sürgősséget!', 'warning');
        return;
    }
    
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        chrome.tabs.sendMessage(tab.id, {
            action: 'savePriority',
            importance: selectedImportance,
            urgency: selectedUrgency
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Hiba:', chrome.runtime.lastError);
                showNotification('❌ Hiba történt! Frissítsd az oldalt.', 'error');
                return;
            }
            
            if (response && response.status === 'success') {
                showNotification('✅ Prioritás elmentve!', 'success');
                
                // Reset selections
                selectedImportance = 0;
                selectedUrgency = 0;
                document.querySelectorAll('.importance-btn, .urgency-btn').forEach(b => {
                    b.classList.remove('selected');
                });
                updateCategoryResult();
            } else {
                showNotification('⚠️ Nincs kiválasztott e-mail', 'warning');
            }
        });
    } catch (error) {
        console.error('Hiba:', error);
        showNotification('❌ Hiba történt!', 'error');
    }
});

// Show notification in popup
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.querySelector('.popup-container').prepend(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Refresh matrix with statistics
function refreshMatrix() {
    chrome.storage.local.get(['emailPriorities'], (result) => {
        const priorities = result.emailPriorities || {};
        
        // Clear all lists
        const lists = {
            'matrix-do-first': [],
            'matrix-schedule': [],
            'matrix-delegate': [],
            'matrix-eliminate': []
        };
        
        Object.entries(priorities).forEach(([id, data]) => {
            const li = document.createElement('li');
            
            // Clean and format subject
            let subject = data.subject || 'Nincs tárgy';
            
            // Remove excessive whitespace and line breaks
            subject = subject.replace(/\s+/g, ' ').trim();
            
            // Extra cleanup: remove any remaining prefixes (safety net)
            subject = subject
                .replace(/^\[Piszkozat\]\s*/i, '')
                .replace(/^Draft:\s*/i, '')
                .replace(/^\[Draft\]\s*/i, '')
                .replace(/^RE:\s*/i, '')
                .replace(/^FW:\s*/i, '')
                .replace(/^VÁL:\s*/i, '')
                .replace(/^TOV:\s*/i, '')
                .trim();
            
            // If empty after cleanup
            if (!subject || subject.length < 2) {
                subject = 'Nincs tárgy';
            }
            
            // Limit length for display (full text in tooltip)
            const displaySubject = subject.length > 60 ? subject.substring(0, 57) + '...' : subject;
            
            li.textContent = displaySubject;
            li.title = `${subject}\nFontosság: ${data.importance}/4\nSürgősség: ${data.urgency}/4\nMentve: ${new Date(data.timestamp).toLocaleString('hu-HU')}`;
            
            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '×';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => deleteEmail(id);
            li.appendChild(deleteBtn);
            
            if (data.importance >= 3 && data.urgency >= 3) {
                lists['matrix-do-first'].push(li);
            } else if (data.importance >= 3 && data.urgency < 3) {
                lists['matrix-schedule'].push(li);
            } else if (data.importance < 3 && data.urgency >= 3) {
                lists['matrix-delegate'].push(li);
            } else {
                lists['matrix-eliminate'].push(li);
            }
        });
        
        // Update DOM
        Object.entries(lists).forEach(([id, items]) => {
            const list = document.getElementById(id);
            list.innerHTML = '';
            
            if (items.length === 0) {
                const emptyLi = document.createElement('li');
                emptyLi.className = 'empty-state';
                emptyLi.textContent = 'Nincs elem';
                list.appendChild(emptyLi);
            } else {
                items.forEach(item => list.appendChild(item));
            }
        });
        
        console.log(`📊 Mátrix frissítve: ${Object.keys(priorities).length} elem`);
    });
}

// Delete email from priorities
function deleteEmail(emailId) {
    if (!confirm('Biztosan törlöd ezt a prioritást?')) return;
    
    chrome.storage.local.get(['emailPriorities'], (result) => {
        const priorities = result.emailPriorities || {};
        delete priorities[emailId];
        chrome.storage.local.set({emailPriorities: priorities}, () => {
            refreshMatrix();
            showNotification('🗑️ Törölve', 'success');
        });
    });
}

// Matrix refresh button
document.getElementById('refresh-matrix')?.addEventListener('click', () => {
    refreshMatrix();
    showNotification('🔄 Frissítve', 'success');
});

// Settings management
document.getElementById('save-settings').addEventListener('click', () => {
    const exchangeUrl = document.getElementById('exchange-url').value;
    const autoCategorize = document.getElementById('auto-categorize').checked;
    
    chrome.storage.sync.set({
        exchangeUrl: exchangeUrl,
        autoCategorize: autoCategorize
    }, () => {
        showNotification('✅ Beállítások elmentve!', 'success');
    });
});

document.getElementById('clear-data').addEventListener('click', () => {
    if (confirm('Biztosan törlöd az összes adatot?')) {
        chrome.storage.local.clear(() => {
            showNotification('✅ Adatok törölve!', 'success');
            refreshMatrix();
        });
    }
});

// Load settings on popup open
window.addEventListener('load', () => {
    chrome.storage.sync.get(['exchangeUrl', 'autoCategorize'], (result) => {
        if (result.exchangeUrl) {
            document.getElementById('exchange-url').value = result.exchangeUrl;
        }
        if (result.autoCategorize !== undefined) {
            document.getElementById('auto-categorize').checked = result.autoCategorize;
        }
    });
    
    // Show statistics
    chrome.storage.local.get(['emailPriorities'], (result) => {
        const count = Object.keys(result.emailPriorities || {}).length;
        console.log(`📧 ${count} priorizált email`);
    });
});

console.log('✅ Popup script inicializálva');
