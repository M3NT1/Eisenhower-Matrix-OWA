// Content Script - Exchange Prioritizer
console.log('📧 Exchange Prioritizer content script betöltve');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'savePriority') {
        // Get the current email info from the page
        const currentEmail = getCurrentEmail();
        
        if (currentEmail) {
            // Debug: log the email element structure
            console.log('📧 Email elem struktúra:', {
                tagName: currentEmail.tagName,
                className: currentEmail.className,
                id: currentEmail.id,
                attributes: Array.from(currentEmail.attributes).map(a => `${a.name}="${a.value}"`),
                innerHTML: currentEmail.innerHTML.substring(0, 500) + '...'
            });
            
            // Additional debug: check for aria-label
            const ariaLabel = currentEmail.getAttribute('aria-label');
            if (ariaLabel) {
                console.log('🏷️ Email aria-label:', ariaLabel);
            }
            
            // Debug: try to find reading pane
            const readingPane = document.querySelector('[role="main"]') || 
                               document.querySelector('div[class*="ReadingPane"]') ||
                               document.querySelector('[aria-label*="Message"]');
            if (readingPane) {
                console.log('📖 Reading Pane talált:', {
                    tagName: readingPane.tagName,
                    className: readingPane.className,
                    firstH1: readingPane.querySelector('h1')?.textContent,
                    firstH2: readingPane.querySelector('h2')?.textContent,
                    subjectElement: readingPane.querySelector('[class*="subject"]')?.textContent
                });
            } else {
                console.warn('⚠️ Reading Pane NEM található');
            }
            
            const emailData = extractEmailData(currentEmail);
            
            console.log('📩 Kinyert email adatok:', {
                id: emailData.id,
                subject: emailData.subject,
                subjectLength: emailData.subject.length
            });
            
            const priorityData = {
                id: emailData.id,
                subject: emailData.subject,
                importance: request.importance,
                urgency: request.urgency,
                timestamp: new Date().toISOString()
            };
            
            // Save to Chrome storage
            chrome.storage.local.get(['emailPriorities'], (result) => {
                const priorities = result.emailPriorities || {};
                priorities[emailData.id] = priorityData;
                chrome.storage.local.set({emailPriorities: priorities}, () => {
                    console.log('✅ Prioritás elmentve:', priorityData);
                });
            });
            
            // Highlight the email on the page
            highlightEmail(currentEmail, request.importance, request.urgency);
            
            sendResponse({status: 'success', message: 'Prioritás mentve'});
        } else {
            console.warn('⚠️ Nincs kiválasztott e-mail');
            sendResponse({status: 'error', message: 'Nincs kiválasztott e-mail'});
        }
        
        return true; // async response
    }
});

// Get currently selected or focused email
function getCurrentEmail() {
    // Multiple selectors for different email clients
    const selectors = [
        // Outlook Web App / OWA
        'div[role="row"][aria-selected="true"]',
        'div[role="listitem"][aria-selected="true"]',
        'div[class*="customScrollBar"] div[aria-selected="true"]',
        'div[data-convid]',
        '[data-is-focusable="true"][aria-selected="true"]',
        
        // Generic selectors
        '[role="option"][aria-expanded="true"]',
        '[role="option"][aria-selected="true"]',
        '[data-convid]',
        '.selected-email',
        '[class*="selected"]',
        'tr.focused',
        'tr.selected',
        
        // Fallback - currently focused element
        'div[tabindex="0"]:focus'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('📮 Email elem találva:', selector);
            return element;
        }
    }
    
    console.warn('⚠️ Nem található email elem');
    return null;
}

// Extract email data from DOM element
function extractEmailData(emailElement) {
    const emailId = emailElement.getAttribute('data-convid') || 
                   emailElement.getAttribute('id') || 
                   emailElement.getAttribute('data-id') ||
                   emailElement.getAttribute('aria-posinset') ||
                   'email_' + Date.now().toString();
    
    let subject = '';
    
    console.log('🔍 Email ID kinyerése:', emailId);
    
    // PRIORITY STRATEGY: Try to get subject from Reading Pane (not from list view)
    // This is the most accurate way to get the actual email subject in OWA
    const readingPaneSelectors = [
        // OWA Reading Pane subject selectors
        '[role="main"] [class*="subject"]',
        '[role="main"] h1',
        '[role="main"] h2',
        '[role="main"] [class*="Subject"]',
        '[aria-label*="Message"] [class*="subject"]',
        'div[class*="ReadingPane"] [class*="subject"]',
        'div[class*="ReadingPane"] h1',
        'div[class*="ReadingPane"] h2',
        '[data-app-section="MailReadingPane"] [class*="subject"]',
        'div[role="region"][aria-label*="Message"] h1',
        'div[role="region"][aria-label*="Message"] h2',
        // Additional OWA selectors
        'div[class*="messageSubject"]',
        'span[class*="messageSubject"]',
        '[id*="SubjectNode"]'
    ];
    
    console.log('🔍 Reading Pane keresés kezdődik...');
    for (const selector of readingPaneSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent?.trim() || element.title?.trim() || '';
            console.log(`  ✓ Selector találat: ${selector} → "${text.substring(0, 50)}..."`);
            if (text && text.length > 3) {
                subject = text;
                console.log('📧 ✅ Tárgy találva Reading Pane-ből:', selector, '→', subject);
                break;
            }
        }
    }
    
    if (!subject) {
        console.log('  ✗ Reading Pane nem talált tárgyat');
    }
    
    // Strategy 1: OWA specific - check for specific subject containers in list item
    if (!subject) {
        console.log('🔍 OWA subject selectors keresés...');
        const owaSubjectSelectors = [
            'span[id*="SubjectContainer"]',
            'span[id*="subject"]',
            'div[id*="SubjectLine"]',
            '[data-automationid="subject"]',
            '[class*="subject"][class*="line"]',
            'span[class*="itemSubject"]'
        ];
        
        for (const selector of owaSubjectSelectors) {
            const element = emailElement.querySelector(selector);
            if (element) {
                const text = element.textContent?.trim() || element.title?.trim() || '';
                console.log(`  Selector próba: ${selector} → "${text.substring(0, 30)}..."`);
                if (text && text.length > 0) {
                    subject = text;
                    console.log('📧 ✅ Tárgy találva OWA selector:', selector, '→', subject);
                    break;
                }
            }
        }
    }
    
    // Strategy 2: Check aria-label (OWA often puts full info here)
    if (!subject) {
        const ariaLabel = emailElement.getAttribute('aria-label');
        if (ariaLabel) {
            console.log('🔍 aria-label tartalom:', ariaLabel);
            
            // OWA aria-label format examples:
            // "Hintalan Tibor (Jira); [JIRA] (EKOZIG-8426) Assigned: #103583 - ...; 13:51; Olvasatlan"
            // "Sender; Subject; Date; Status"
            
            const parts = ariaLabel.split(';').map(p => p.trim());
            
            // Look for JIRA ticket patterns or longer meaningful text
            const jiraPattern = /\[JIRA\]|\(.*-\d+\)|#\d+|Assigned:|Updated:/i;
            
            for (let i = 0; i < parts.length && i < 6; i++) {
                const part = parts[i];
                
                // Prioritize JIRA-like subjects
                if (jiraPattern.test(part)) {
                    subject = part;
                    console.log('📧 Tárgy találva aria-label-ből (JIRA pattern):', subject);
                    break;
                }
                
                // Look for longer text that's not a name, date, or status
                if (part.length > 15 && 
                    !part.match(/^\d{1,2}:\d{2}/) &&  // Not time
                    !part.match(/^\d{4}/) &&  // Not year
                    !part.toLowerCase().includes('olvasatlan') &&
                    !part.toLowerCase().includes('unread') &&
                    !part.toLowerCase().includes('draft') &&
                    !part.toLowerCase().includes('piszkozat') &&
                    !part.match(/\(\w+\)$/)) {  // Not ending with (Name)
                    subject = part;
                    console.log('📧 Tárgy találva aria-label részből:', subject);
                    break;
                }
            }
            
            // Fallback: if still no subject and there are at least 2 parts, use second
            if (!subject && parts.length >= 2) {
                const secondPart = parts[1];
                // Only use if it's not too short (likely not just a name)
                if (secondPart.length > 5) {
                    subject = secondPart;
                    console.log('📧 Tárgy találva aria-label 2. részből:', subject);
                }
            }
        }
    }
    
    // Strategy 3: Check title attribute
    if (!subject) {
        const title = emailElement.getAttribute('title') || emailElement.title;
        if (title && title.length > 3) {
            subject = title;
            console.log('📧 Tárgy találva title-ből:', subject);
        }
    }
    
    // Strategy 4: Generic subject class selectors
    if (!subject) {
        const genericSelectors = [
            '[class*="subject"]',
            '[data-subject]',
            '.item-subject',
            'td[class*="subject"]'
        ];
        
        for (const selector of genericSelectors) {
            const element = emailElement.querySelector(selector);
            if (element) {
                const text = element.textContent?.trim() || '';
                if (text && text.length > 0) {
                    subject = text;
                    console.log('📧 Tárgy találva generic selector:', selector, '→', subject);
                    break;
                }
            }
        }
    }
    
    // Strategy 5: Intelligent span detection (skip email addresses, names, dates)
    // NEW: Find the LONGEST meaningful text in spans
    if (!subject) {
        console.log('🔍 Intelligens span keresés...');
        const spans = emailElement.querySelectorAll('span');
        console.log(`  Talált ${spans.length} span elem`);
        
        let candidates = [];
        
        for (const span of spans) {
            const text = span.textContent?.trim() || '';
            
            // Skip empty, short, and obvious non-subjects
            if (!text || text.length < 10) continue;
            if (text.includes('@')) continue;  // Email address
            if (text.match(/^\d+[\/\-\.]\d+/)) continue;  // Dates
            if (text.match(/^\d+:\d+/)) continue;  // Times
            if (text.toLowerCase() === 'piszkozat') continue;
            if (text.toLowerCase() === 'draft') continue;
            
            candidates.push({
                text: text,
                length: text.length
            });
        }
        
        // Log all candidates
        console.log('  Tárgy kandidátusok:', candidates.map(c => `"${c.text.substring(0, 40)}..." (${c.length})`));
        
        // Sort by length and take the longest one (likely the subject)
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.length - a.length);
            subject = candidates[0].text;
            console.log('📧 ✅ Tárgy találva span intelligens kereséssel (leghosszabb):', subject);
        }
    }
    
    // Fallback
    if (!subject || subject.trim() === '') {
        subject = 'Email ' + new Date().toLocaleTimeString('hu-HU');
        console.warn('⚠️ Tárgy nem található, fallback használva:', subject);
    }
    
    // Clean the subject
    subject = subject
        .replace(/\s+/g, ' ')  // Remove multiple spaces
        .replace(/\n/g, ' ')   // Remove newlines
        .trim();
    
    // Remove OWA prefixes and artifacts
    const prefixesToRemove = [
        /^\[Piszkozat\]\s*/i,           // [Piszkozat]
        /^Draft:\s*/i,                  // Draft:
        /^\[Draft\]\s*/i,               // [Draft]
        /^RE:\s*/i,                     // RE:
        /^FW:\s*/i,                     // FW:
        /^FWD:\s*/i,                    // FWD:
        /^VÁL:\s*/i,                    // VÁL:
        /^TOV:\s*/i,                    // TOV:
        /^\[EXTERNAL\]\s*/i,            // [EXTERNAL]
        /^\[KÜLSŐ\]\s*/i,               // [KÜLSŐ]
        /^Unread,?\s*/i,                // Unread,
        /^Olvasatlan,?\s*/i             // Olvasatlan,
    ];
    
    for (const prefix of prefixesToRemove) {
        subject = subject.replace(prefix, '');
    }
    
    // Trim again after prefix removal and limit length
    subject = subject.trim().substring(0, 200);
    
    // If after cleaning nothing remains, use fallback
    if (!subject || subject.length < 2) {
        subject = 'Email ' + new Date().toLocaleTimeString('hu-HU');
        console.warn('⚠️ Tisztítás után üres tárgy, fallback használva:', subject);
    }
    
    console.log('✅ Végső tárgy:', subject);
    
    return {
        id: emailId,
        subject: subject
    };
}

// Highlight email based on priority
function highlightEmail(emailElement, importance, urgency) {
    let color = '';
    let borderColor = '';
    let category = '';
    
    if (importance >= 3 && urgency >= 3) {
        color = '#ffe6e6';
        borderColor = '#ff4444';
        category = 'Do First';
    } else if (importance >= 3 && urgency < 3) {
        color = '#fff9e6';
        borderColor = '#ffb84d';
        category = 'Schedule';
    } else if (importance < 3 && urgency >= 3) {
        color = '#e6f3ff';
        borderColor = '#4499ff';
        category = 'Delegate';
    } else {
        color = '#e6ffe6';
        borderColor = '#44bb44';
        category = 'Eliminate';
    }
    
    // Highlight email in list
    emailElement.style.backgroundColor = color;
    emailElement.style.borderLeft = `4px solid ${borderColor}`;
    emailElement.style.paddingLeft = '12px';
    emailElement.style.transition = 'all 0.3s ease';
    
    // Add data attribute for tracking
    emailElement.setAttribute('data-priority-category', category);
    emailElement.setAttribute('data-priority-importance', importance);
    emailElement.setAttribute('data-priority-urgency', urgency);
    
    console.log(`🎨 Email kiemelve listában: ${category}`);
}

// Add priority badge to Reading Pane
function addReadingPaneBadge(category, color, icon, importance, urgency) {
    // Check if badge already exists with same content
    const existingBadge = document.querySelector('[role="main"] .eisenhower-badge');
    if (existingBadge) {
        const existingText = existingBadge.querySelector('.badge-text')?.textContent;
        if (existingText === category) {
            console.log('ℹ️ Badge már létezik ugyanazzal a kategóriával, skip');
            return; // Don't recreate if it's the same
        }
        // Remove old badge container
        existingBadge.parentElement?.remove();
    }
    
    // Find Reading Pane header container - where the sender name and date are
    const headerContainerSelectors = [
        '[role="main"] [class*="_rp_o1"]', // OWA header container
        '[role="main"] [role="heading"][aria-level="3"]', // Header with sender info
        '[role="main"] [class*="ItemHeader"]',
        '[role="main"] [class*="messageHeader"]',
        '[data-app-section="MailReadingPane"] [class*="header"]'
    ];
    
    let headerContainer = null;
    for (const selector of headerContainerSelectors) {
        headerContainer = document.querySelector(selector);
        if (headerContainer) {
            console.log('📌 Reading Pane header találva badge-hez:', selector);
            break;
        }
    }
    
    if (!headerContainer) {
        console.warn('⚠️ Reading Pane header nem található badge-hez');
        return;
    }
    
    // Find the best insertion point - after sender info, before action buttons
    const insertionPointSelectors = [
        '[class*="_rp_32"]', // Date/time container in OWA
        '[class*="_rp_q2"]', // Header row container
        '[class*="ItemHeader"]'
    ];
    
    let insertionPoint = null;
    for (const selector of insertionPointSelectors) {
        insertionPoint = headerContainer.querySelector(selector);
        if (insertionPoint) {
            console.log('📍 Badge beszúrási pont:', selector);
            break;
        }
    }
    
    // Fallback to header container itself
    const targetElement = insertionPoint || headerContainer;
    
    // Create badge element
    const badge = document.createElement('div');
    badge.className = 'eisenhower-badge';
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
        background: `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)`,
        border: `2px solid ${color}`,
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '600',
        color: color,
        verticalAlign: 'middle',
        animation: 'badgeFadeIn 0.3s ease',
        boxShadow: `0 2px 8px ${color}40`
    });
    
    // Add animation
    if (!document.querySelector('#eisenhower-badge-animation')) {
        const style = document.createElement('style');
        style.id = 'eisenhower-badge-animation';
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
            .eisenhower-badge .badge-icon {
                font-size: 16px;
                line-height: 1;
            }
            .eisenhower-badge .badge-text {
                font-weight: 700;
            }
            .eisenhower-badge .badge-meta {
                font-size: 11px;
                opacity: 0.8;
                margin-left: 4px;
                padding-left: 8px;
                border-left: 1px solid currentColor;
            }
            .eisenhower-badge {
                margin-top: 8px;
                margin-bottom: 8px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Insert badge as a new row in the header area
    const badgeContainer = document.createElement('div');
    badgeContainer.style.cssText = 'display: flex; align-items: center; margin-top: 8px; margin-bottom: 4px;';
    badgeContainer.appendChild(badge);
    
    // Insert after the target element (date/time row)
    if (targetElement.nextSibling) {
        targetElement.parentElement.insertBefore(badgeContainer, targetElement.nextSibling);
    } else {
        targetElement.parentElement.appendChild(badgeContainer);
    }
    
    console.log(`✅ Badge hozzáadva Reading Pane-hez: ${category}`);
}

// Apply saved priorities on page load
function applySavedPriorities() {
    try {
        chrome.storage.local.get(['emailPriorities'], (result) => {
            if (chrome.runtime.lastError) {
                console.log('ℹ️ Storage nem elérhető:', chrome.runtime.lastError.message);
                return;
            }
            
            const priorities = result.emailPriorities || {};
            const count = Object.keys(priorities).length;
            
            console.log(`📊 ${count} mentett prioritás betöltése...`);
        
        // Try different email list selectors
        const emailSelectors = [
            '[data-convid]',
            '[role="option"]',
            'tr[class*="email"]',
            '.email-item',
            '[class*="mail-item"]'
        ];
        
        let foundElements = [];
        for (const selector of emailSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                foundElements = elements;
                console.log(`✅ ${elements.length} email elem találva: ${selector}`);
                break;
            }
        }
        
        foundElements.forEach(element => {
            const emailId = element.getAttribute('data-convid') || 
                           element.getAttribute('id') ||
                           element.getAttribute('data-id');
            
            if (emailId && priorities[emailId]) {
                const data = priorities[emailId];
                highlightEmail(element, data.importance, data.urgency);
            }
        });
        
        // Check if currently selected email has priority and show badge
        checkSelectedEmailForBadge(priorities);
        });
    } catch (error) {
        console.log('ℹ️ Extension context invalidated, script leáll:', error.message);
    }
}

// Check if selected email has priority and show badge in Reading Pane
function checkSelectedEmailForBadge(priorities) {
    const currentEmail = getCurrentEmail();
    if (!currentEmail) {
        console.log('⚠️ Nincs kiválasztott email');
        return;
    }
    
    const emailId = currentEmail.getAttribute('data-convid') || 
                   currentEmail.getAttribute('id') || 
                   currentEmail.getAttribute('data-id');
    
    if (!emailId) {
        console.log('⚠️ Email ID nem található');
        return;
    }
    
    // Check if this email has a saved priority
    if (!priorities[emailId]) {
        console.log(`ℹ️ Email nincs priorizálva, badge nem jelenik meg (ID: ${emailId})`);
        // Remove any existing badge since this email is not prioritized
        const existingBadge = document.querySelector('[role="main"] .eisenhower-badge');
        if (existingBadge) {
            existingBadge.parentElement?.remove();
            console.log('🗑️ Korábbi badge eltávolítva');
        }
        return;
    }
    
    const data = priorities[emailId];
    
    let badgeColor = '';
    let badgeIcon = '';
    let category = '';
    
    if (data.importance >= 3 && data.urgency >= 3) {
        badgeColor = '#ef4444';
        badgeIcon = '🔴';
        category = 'Do First';
    } else if (data.importance >= 3 && data.urgency < 3) {
        badgeColor = '#f59e0b';
        badgeIcon = '🟡';
        category = 'Schedule';
    } else if (data.importance < 3 && data.urgency >= 3) {
        badgeColor = '#3b82f6';
        badgeIcon = '🔵';
        category = 'Delegate';
    } else {
        badgeColor = '#10b981';
        badgeIcon = '🟢';
        category = 'Eliminate';
    }
    
    addReadingPaneBadge(category, badgeColor, badgeIcon, data.importance, data.urgency);
    console.log(`🏷️ Badge megjelenítve: ${category} (F:${data.importance}/4, S:${data.urgency}/4)`);
}

// Initialize on page load
window.addEventListener('load', () => {
    console.log('📄 Oldal betöltve, prioritások alkalmazása...');
    setTimeout(applySavedPriorities, 1000); // Wait for dynamic content
});

// Listen for email selection changes (click on email)
let isProcessingClick = false;
document.addEventListener('click', (e) => {
    // Ignore clicks on badge itself
    if (e.target.closest('.eisenhower-badge')) {
        return;
    }
    
    // Check if clicked on an email item
    const emailElement = e.target.closest('[data-convid], [role="option"][aria-selected="true"]');
    if (emailElement && !isProcessingClick) {
        isProcessingClick = true;
        setTimeout(() => {
            chrome.storage.local.get(['emailPriorities'], (result) => {
                const priorities = result.emailPriorities || {};
                checkSelectedEmailForBadge(priorities);
                isProcessingClick = false;
            });
        }, 300); // Wait for Reading Pane to update
    }
});

// Debounce function to prevent rapid consecutive calls
let mutationTimeout = null;
let lastBadgeUpdate = 0;
const BADGE_UPDATE_COOLDOWN = 1000; // 1 second cooldown

// Observe DOM changes for dynamically loaded emails
const observer = new MutationObserver((mutations) => {
    let shouldReapply = false;
    let readingPaneChanged = false;
    
    mutations.forEach(mutation => {
        // Skip if the mutation is our own badge
        const isBadgeMutation = Array.from(mutation.addedNodes).some(node => 
            node.classList && (node.classList.contains('eisenhower-badge') || node.id === 'eisenhower-badge-animation')
        );
        
        if (isBadgeMutation) {
            return; // Skip our own changes
        }
        
        if (mutation.addedNodes.length > 0) {
            shouldReapply = true;
            
            // Check if Reading Pane content changed
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    if (node.matches && (
                        node.matches('[role="main"]') ||
                        node.matches('[class*="ReadingPane"]') ||
                        node.querySelector('[class*="Subject"]')
                    )) {
                        readingPaneChanged = true;
                    }
                }
            });
        }
    });
    
    // Debounce the reapply
    if (shouldReapply) {
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
            console.log('🔄 DOM változás észlelve, prioritások újraalkalmazása...');
            applySavedPriorities();
        }, 500); // Debounce 500ms
    }
    
    // Throttle badge updates
    if (readingPaneChanged) {
        const now = Date.now();
        if (now - lastBadgeUpdate > BADGE_UPDATE_COOLDOWN) {
            lastBadgeUpdate = now;
            console.log('📖 Reading Pane változás, badge frissítése...');
            chrome.storage.local.get(['emailPriorities'], (result) => {
                const priorities = result.emailPriorities || {};
                checkSelectedEmailForBadge(priorities);
            });
        }
    }
});

// Start observing after a short delay
setTimeout(() => {
    // Observe with filter to reduce noise
    const targetNode = document.querySelector('[role="main"]') || document.body;
    
    observer.observe(targetNode, {
        childList: true,
        subtree: true,
        // Don't observe attributes to reduce mutation count
        attributes: false,
        characterData: false
    });
    console.log('👁️ DOM változás megfigyelő elindítva');
}, 2000);

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    observer.disconnect();
    console.log('👋 Content script leállítva');
});