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
        } else if (tabName === 'weblinks') {
            refreshWebLinks();
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

// Refresh web links matrix
function refreshWebLinks() {
    chrome.storage.local.get(['webLinkPriorities'], (result) => {
        const webLinks = result.webLinkPriorities || {};
        
        // Clear all lists
        const lists = {
            'weblinks-do-first': [],
            'weblinks-schedule': [],
            'weblinks-delegate': [],
            'weblinks-eliminate': []
        };
        
        Object.entries(webLinks).forEach(([url, data]) => {
            const li = document.createElement('li');
            li.className = 'email-item weblink-item';
            li.setAttribute('data-url', url);
            
            // Truncate title
            let displayTitle = data.title || url;
            const MAX_LENGTH = 45;
            if (displayTitle.length > MAX_LENGTH) {
                displayTitle = displayTitle.substring(0, MAX_LENGTH - 3) + '...';
            }
            
            // Create clickable link
            const linkSpan = document.createElement('span');
            linkSpan.className = 'email-subject';
            linkSpan.textContent = displayTitle;
            linkSpan.title = `${data.title}\n🌐 ${data.hostname}\n📅 ${new Date(data.timestamp).toLocaleString('hu-HU')}\n\n🖱️ Kattints a megnyitáshoz`;
            linkSpan.style.cursor = 'pointer';
            
            // Click to open URL
            linkSpan.onclick = (e) => {
                e.stopPropagation();
                chrome.tabs.create({ url: url });
            };
            
            li.appendChild(linkSpan);
            
            // Add navigation button
            const navBtn = document.createElement('button');
            navBtn.innerHTML = '🔗';
            navBtn.className = 'nav-btn';
            navBtn.title = 'Megnyitás új lapon';
            navBtn.onclick = (e) => {
                e.stopPropagation();
                chrome.tabs.create({ url: url });
            };
            li.appendChild(navBtn);
            
            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.className = 'delete-btn';
            deleteBtn.title = 'Törlés';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteWebLink(url);
            };
            li.appendChild(deleteBtn);
            
            // Categorize
            const importance = data.importance || 2;
            const urgency = data.urgency || 2;
            
            if (importance >= 3 && urgency >= 3) {
                lists['weblinks-do-first'].push(li);
            } else if (importance >= 3 && urgency < 3) {
                lists['weblinks-schedule'].push(li);
            } else if (importance < 3 && urgency >= 3) {
                lists['weblinks-delegate'].push(li);
            } else {
                lists['weblinks-eliminate'].push(li);
            }
        });
        
        // Update DOM
        for (const [listId, items] of Object.entries(lists)) {
            const listElement = document.getElementById(listId);
            if (listElement) {
                listElement.innerHTML = '';
                if (items.length === 0) {
                    const emptyLi = document.createElement('li');
                    emptyLi.className = 'empty-state';
                    emptyLi.textContent = 'Nincs elem';
                    listElement.appendChild(emptyLi);
                } else {
                    items.forEach(item => listElement.appendChild(item));
                }
            }
        }
        
        console.log('📊 Web Links frissítve:', Object.keys(webLinks).length, 'elem');
    });
}

// Delete web link
function deleteWebLink(url) {
    if (!confirm('Biztosan törlöd ezt a linket?')) return;
    
    chrome.storage.local.get(['webLinkPriorities'], (result) => {
        const webLinks = result.webLinkPriorities || {};
        delete webLinks[url];
        
        chrome.storage.local.set({ webLinkPriorities: webLinks }, () => {
            refreshWebLinks();
            showNotification('✅ Link törölve!', 'success');
        });
    });
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
            li.className = 'email-item';
            li.setAttribute('data-email-id', id);
            
            // Use custom label if exists, otherwise use subject
            let displayText = data.customLabel || data.subject || 'Nincs tárgy';
            
            // Clean and format subject (original for tooltip)
            let subject = data.subject || 'Nincs tárgy';
            subject = subject.replace(/\s+/g, ' ').trim();
            subject = subject
                .replace(/^\[Piszkozat\]\s*/i, '')
                .replace(/^Draft:\s*/i, '')
                .replace(/^\[Draft\]\s*/i, '')
                .replace(/^RE:\s*/i, '')
                .replace(/^FW:\s*/i, '')
                .replace(/^VÁL:\s*/i, '')
                .replace(/^TOV:\s*/i, '')
                .trim();
            
            if (!subject || subject.length < 2) {
                subject = 'Nincs tárgy';
            }
            
            // Strict limit: 40 chars max for display
            const MAX_DISPLAY_LENGTH = 40;
            if (displayText.length > MAX_DISPLAY_LENGTH) {
                displayText = displayText.substring(0, MAX_DISPLAY_LENGTH - 3) + '...';
            }
            
            // Create subject span (clickable to show preview)
            const subjectSpan = document.createElement('span');
            subjectSpan.className = 'email-subject';
            subjectSpan.textContent = displayText;
            subjectSpan.title = `${data.customLabel ? '🏷️ ' + data.customLabel + '\n' : ''}📧 ${subject}\nFontosság: ${data.importance}/4\nSürgősség: ${data.urgency}/4\nMentve: ${new Date(data.timestamp).toLocaleString('hu-HU')}\n\n🖱️ Kattints az előnézethez`;
            subjectSpan.style.cursor = 'pointer';
            
            // Click to show email preview modal
            subjectSpan.onclick = (e) => {
                e.stopPropagation();
                showEmailPreview(id, data);
            };
            
            li.appendChild(subjectSpan);
            
            // Add rename button (edit label icon)
            const renameBtn = document.createElement('button');
            renameBtn.innerHTML = '✏️';
            renameBtn.className = 'rename-btn';
            renameBtn.title = 'Átnevezés';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                renameEmail(id, data);
            };
            li.appendChild(renameBtn);
            
            // Add navigation button (open email icon)
            const navBtn = document.createElement('button');
            navBtn.innerHTML = '📧';
            navBtn.className = 'nav-btn';
            navBtn.title = 'Megnyitás az Outlook-ban';
            navBtn.onclick = async (e) => {
                e.stopPropagation();
                await openEmailInOWA(id, data.subject, data.timestamp);
            };
            li.appendChild(navBtn);
            
            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '×';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteEmail(id);
            };
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
            
            // Notify content script to remove highlighting and badge
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'removeHighlight',
                        emailId: emailId
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('Content script not active or email not in current page');
                        }
                    });
                }
            });
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

// Open full settings page
document.getElementById('open-full-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

document.getElementById('clear-data').addEventListener('click', () => {
    if (confirm('Biztosan törlöd az összes adatot?')) {
        chrome.storage.local.clear(() => {
            showNotification('✅ Adatok törölve!', 'success');
            refreshMatrix();
        });
    }
});

// Open email in OWA by clicking on the email element in the list
async function openEmailInOWA(emailId, emailSubject, emailTimestamp) {
    try {
        console.log('📬 Attempting to open email:', emailId, emailSubject);
        
        // Get all tabs
        const tabs = await chrome.tabs.query({});
        
        // Find OWA tab (check for common OWA URLs)
        const owaTab = tabs.find(tab => 
            tab.url && (
                tab.url.includes('outlook.office.com') ||
                tab.url.includes('outlook.office365.com') ||
                tab.url.includes('/owa/') ||
                tab.url.includes('outlook.live.com')
            )
        );
        
        if (!owaTab) {
            showNotification('⚠️ Outlook Web App nincs megnyitva', 'error');
            return;
        }
        
        // Switch to OWA tab
        await chrome.tabs.update(owaTab.id, { active: true });
        await chrome.windows.update(owaTab.windowId, { focused: true });
        
        // Send message to content script to open the email
        chrome.tabs.sendMessage(owaTab.id, {
            action: 'openEmail',
            emailId: emailId,
            emailSubject: emailSubject,
            emailTimestamp: emailTimestamp
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error opening email:', chrome.runtime.lastError);
                showNotification('⚠️ Nem sikerült megnyitni az emailt', 'error');
            } else if (response && response.success) {
                console.log('✅ Email megnyitva:', emailId);
                // Close popup after opening email
                window.close();
            } else {
                showNotification('⚠️ Email nem található a listában', 'error');
            }
        });
        
    } catch (error) {
        console.error('Error in openEmailInOWA:', error);
        showNotification('❌ Hiba történt', 'error');
    }
}

// Rename email with custom label
function renameEmail(emailId, data) {
    const currentLabel = data.customLabel || data.subject || '';
    const newLabel = prompt('Add meg az új címkét:', currentLabel);
    
    if (newLabel === null) return; // Cancelled
    
    chrome.storage.local.get(['emailPriorities'], (result) => {
        const priorities = result.emailPriorities || {};
        
        if (priorities[emailId]) {
            priorities[emailId].customLabel = newLabel.trim();
            
            chrome.storage.local.set({ emailPriorities: priorities }, () => {
                showNotification('✅ Címke frissítve!', 'success');
                refreshMatrix();
            });
        }
    });
}

// Show email preview modal
function showEmailPreview(emailId, data) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'email-preview-modal';
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    const title = document.createElement('h3');
    title.textContent = data.customLabel || data.subject || 'Nincs tárgy';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => modal.remove();
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    // Email details
    const details = document.createElement('div');
    details.className = 'email-details';
    
    // Subject row
    const subjectRow = document.createElement('div');
    subjectRow.className = 'detail-row';
    subjectRow.innerHTML = `<strong>📧 Tárgy:</strong> ${data.subject || 'Nincs tárgy'}`;
    details.appendChild(subjectRow);
    
    // Custom label row (if exists)
    if (data.customLabel) {
        const labelRow = document.createElement('div');
        labelRow.className = 'detail-row';
        labelRow.innerHTML = `<strong>🏷️ Címke:</strong> ${data.customLabel}`;
        details.appendChild(labelRow);
    }
    
    // Priority row
    const priorityRow = document.createElement('div');
    priorityRow.className = 'detail-row';
    priorityRow.innerHTML = `
        <strong>📊 Prioritás:</strong> 
        <span class="priority-badge importance">Fontosság: ${data.importance}/4</span>
        <span class="priority-badge urgency">Sürgősség: ${data.urgency}/4</span>
    `;
    details.appendChild(priorityRow);
    
    // Timestamp row
    const timestampRow = document.createElement('div');
    timestampRow.className = 'detail-row';
    timestampRow.innerHTML = `<strong>🕒 Mentve:</strong> ${new Date(data.timestamp).toLocaleString('hu-HU')}`;
    details.appendChild(timestampRow);
    
    body.appendChild(details);
    
    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    
    const openBtn = document.createElement('button');
    openBtn.className = 'btn-primary';
    openBtn.textContent = '📧 Megnyitás Outlook-ban';
    openBtn.onclick = async () => {
        modal.remove();
        await openEmailInOWA(emailId, data.subject, data.timestamp);
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Bezár';
    cancelBtn.onclick = () => modal.remove();
    
    actions.appendChild(openBtn);
    actions.appendChild(cancelBtn);
    
    body.appendChild(actions);
    
    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modal.appendChild(modalContent);
    
    document.body.appendChild(modal);
}

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
