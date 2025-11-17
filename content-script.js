// Content Script - Exchange Prioritizer
console.log('📧 Exchange Prioritizer content script betöltve');

// Check if current page is allowed to run
const currentUrl = window.location.href;
const currentHost = window.location.hostname;

// Default allowed hosts (built-in support)
const defaultAllowedHosts = [
    'xch.ulyssys.hu',
    'outlook.office365.com',
    'outlook.office.com',
    'outlook.live.com'
];

// Check if current host is allowed
function isAllowedHost(hostname, customUrls = []) {
    // Check default hosts
    if (defaultAllowedHosts.includes(hostname)) {
        return true;
    }
    
    // Check custom URLs from settings
    for (const url of customUrls) {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname === hostname) {
                return true;
            }
        } catch (e) {
            console.warn('⚠️ Érvénytelen egyedi URL:', url);
        }
    }
    
    return false;
}

// Initialize content script only on allowed hosts
chrome.storage.local.get(['customExchangeUrls'], (result) => {
    const customUrls = result.customExchangeUrls || [];
    
    if (!isAllowedHost(currentHost, customUrls)) {
        console.log(`🚫 Exchange Prioritizer letiltva ezen az oldalon: ${currentHost}`);
        console.log('ℹ️ Engedélyezett szerverek:', [...defaultAllowedHosts, ...customUrls]);
        return; // Stop execution
    }
    
    console.log(`✅ Exchange Prioritizer fut: ${currentHost}`);
    initializeExtension();
});

// Main initialization function
function initializeExtension() {

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle context menu categorization
    if (request.action === 'categorizeFromContextMenu') {
        console.log('🖱️ Context menu kategorizálás:', request.importance, request.urgency);
        
        // Try to get selected email first, fallback to Reading Pane email
        let currentEmail = getCurrentEmail();
        
        // If no selected email, try to get from Reading Pane (currently open email)
        if (!currentEmail) {
            console.log('🔍 Nincs kiválasztott email, Reading Pane próba...');
            const readingPaneEmail = getReadingPaneEmail();
            if (readingPaneEmail) {
                currentEmail = readingPaneEmail;
                console.log('✅ Reading Pane email találva');
            }
        }
        
        if (currentEmail) {
            const emailData = extractEmailData(currentEmail);
            
            if (!emailData.subject || emailData.subject.length < 3) {
                console.warn('⚠️ Érvénytelen email tárgy');
                showInPageNotification('⚠️ Nincs megnyitott vagy kiválasztott e-mail');
                sendResponse({success: false, error: 'Invalid email subject'});
                return true;
            }
            
            const priorityData = {
                id: emailData.id,
                subject: emailData.subject,
                importance: request.importance,
                urgency: request.urgency,
                timestamp: Date.now()
            };
            
            // Save to Chrome storage
            chrome.storage.local.get(['emailPriorities'], (result) => {
                const priorities = result.emailPriorities || {};
                priorities[emailData.id] = priorityData;
                chrome.storage.local.set({emailPriorities: priorities}, () => {
                    console.log('✅ Prioritás elmentve (context menu):', priorityData);
                    
                    // Highlight the email if it's in list view
                    if (currentEmail.hasAttribute('role') && currentEmail.getAttribute('role') === 'row') {
                        highlightEmail(currentEmail, request.importance, request.urgency);
                    }
                    
                    // Show success notification
                    const categoryNames = {
                        '4-4': '🔴 Do First',
                        '4-2': '🟡 Schedule',
                        '2-4': '🔵 Delegate',
                        '2-2': '🟢 Eliminate'
                    };
                    const categoryKey = `${request.importance}-${request.urgency}`;
                    const categoryName = categoryNames[categoryKey] || 'kategória';
                    showInPageNotification(`✅ Email hozzáadva: ${categoryName}`);
                    
                    sendResponse({success: true, emailData: priorityData});
                });
            });
            
            return true; // async response
        } else {
            console.warn('⚠️ Nincs megnyitott vagy kiválasztott e-mail');
            showInPageNotification('⚠️ Nyiss meg egy e-mailt a kategorizáláshoz');
            sendResponse({success: false, error: 'No email found'});
        }
        
        return true;
    }
    
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

// Get email from Reading Pane (currently open email)
function getReadingPaneEmail() {
    console.log('🔍 Reading Pane email keresés...');
    
    // Try to find Reading Pane container
    const readingPaneSelectors = [
        '[role="main"]',
        'div[class*="ReadingPane"]',
        '[data-app-section="MailReadingPane"]',
        'div[role="region"][aria-label*="Message"]'
    ];
    
    for (const selector of readingPaneSelectors) {
        const pane = document.querySelector(selector);
        if (pane) {
            console.log('📮 Reading Pane találva:', selector);
            // Create a pseudo-element representing the Reading Pane email
            return {
                isReadingPane: true,
                readingPaneContainer: pane,
                getAttribute: (attr) => {
                    if (attr === 'data-convid' || attr === 'id') {
                        // Generate ID from Reading Pane content
                        const subjectEl = pane.querySelector('[class*="subject"], h1, h2');
                        const subject = subjectEl?.textContent?.trim() || '';
                        return 'rp_' + hashCode(subject);
                    }
                    return null;
                },
                querySelector: (sel) => pane.querySelector(sel),
                hasAttribute: () => false
            };
        }
    }
    
    console.warn('⚠️ Reading Pane nem található');
    return null;
}

// Simple hash function for generating IDs
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

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
    // Handle Reading Pane pseudo-element
    if (emailElement.isReadingPane) {
        const pane = emailElement.readingPaneContainer;
        const subjectSelectors = [
            '[class*="subject"]',
            'h1',
            'h2',
            '[class*="Subject"]',
            'div[class*="messageSubject"]',
            'span[class*="messageSubject"]'
        ];
        
        let subject = '';
        for (const selector of subjectSelectors) {
            const element = pane.querySelector(selector);
            if (element) {
                const text = element.textContent?.trim() || '';
                if (text && text.length > 3) {
                    subject = text;
                    break;
                }
            }
        }
        
        const emailId = emailElement.getAttribute('data-convid') || emailElement.getAttribute('id');
        console.log('📧 Reading Pane email adatok:', {id: emailId, subject: subject.substring(0, 50)});
        
        return {
            id: emailId,
            subject: subject,
            from: '',
            date: ''
        };
    }
    
    // Normal email element handling
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

// Listen for messages from popup to open specific email
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openEmail') {
        const emailId = request.emailId;
        const emailSubject = request.emailSubject;
        console.log('📬 Email megnyitási kérés:', emailId, emailSubject);
        
        // Strategy 1: Find by exact ID match
        let emailElement = document.querySelector(`[data-convid="${emailId}"]`) ||
                          document.querySelector(`[id="${emailId}"]`) ||
                          document.querySelector(`[data-id="${emailId}"]`);

        // Strategy 2: If not found by ID, search by subject in aria-label or text content
        if (!emailElement && emailSubject) {
            const emailTimestamp = request.emailTimestamp;
            console.log('🔍 Keresés tárgy alapján:', emailSubject, 'timestamp:', emailTimestamp);

            // Clean the subject for searching (remove prefixes)
            const cleanSubject = emailSubject
                .replace(/^\[Piszkozat\]\s*/i, '')
                .replace(/^Draft:\s*/i, '')
                .replace(/^\[Draft\]\s*/i, '')
                .replace(/^RE:\s*/i, '')
                .replace(/^FW:\s*/i, '')
                .replace(/^VÁL:\s*/i, '')
                .replace(/^TOV:\s*/i, '')
                .replace(/^\[EXTERNAL\]\s*/i, '')
                .replace(/^\[KÜLSŐ\]\s*/i, '')
                .trim();

            // Search in email list items and collect candidates
            const allEmailItems = document.querySelectorAll('[data-convid], [role="option"]');
            console.log(`🔍 ${allEmailItems.length} email elem átvizsgálása...`);
            const candidates = [];

            for (const item of allEmailItems) {
                const ariaLabel = item.getAttribute('aria-label') || '';
                const textContent = item.textContent || '';

                // Exact or partial match in aria-label or text content
                if (ariaLabel.includes(cleanSubject) || textContent.includes(cleanSubject)) {
                    candidates.push(item);
                }
            }

            // If single candidate, pick it
            if (candidates.length === 1) {
                emailElement = candidates[0];
                console.log('✅ Egyértelmű találat tárgy alapján');
            } else if (candidates.length > 1) {
                console.log(`⚠️ Több találat (${candidates.length}), próbálkozás timestamp alapján...`);

                // Helper: try parse date-like string from an element (title or text)
                function parseDateFromString(s) {
                    if (!s) return null;
                    // try patterns like: 2025. 11. 17. 14:17 or 2025-11-17T14:17
                    let m = s.match(/(\d{4})[^\d]*(\d{1,2})[^\d]*(\d{1,2})[^\d]*(\d{1,2}):(\d{2})/);
                    if (m) {
                        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
                    }
                    m = s.match(/(\d{4})-(\d{2})-(\d{2})T?(\d{2}):(\d{2})/);
                    if (m) {
                        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
                    }
                    return null;
                }

                let best = null;
                let bestDiff = Infinity;
                for (const cand of candidates) {
                    // look for title attributes or time elements under the candidate
                    const nodes = cand.querySelectorAll('[title], time, span');
                    for (const n of nodes) {
                        const txt = n.getAttribute('title') || n.textContent || '';
                        const parsed = parseDateFromString(txt);
                        if (parsed && emailTimestamp) {
                            const diff = Math.abs(parsed.getTime() - Number(emailTimestamp));
                            if (diff < bestDiff) {
                                bestDiff = diff;
                                best = cand;
                            }
                        }
                    }
                }

                // If we found a close timestamp match (within 1 day), use it
                if (best && bestDiff < 24 * 60 * 60 * 1000) {
                    emailElement = best;
                    console.log('✅ Találat timestamp alapján (bestDiff ms):', bestDiff);
                } else {
                    // Fallback: use first candidate
                    emailElement = candidates[0];
                    console.log('ℹ️ Timestamp alapján nem sikerült egyértelműsíteni, az első találatot használjuk');
                }
            }
        }
        
        if (emailElement) {
            // Scroll into view
            emailElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight briefly
            const originalBg = emailElement.style.backgroundColor;
            emailElement.style.backgroundColor = '#ffeb3b';
            
            // Click to open
            setTimeout(() => {
                emailElement.style.backgroundColor = originalBg;
                emailElement.click();
                console.log('✅ Email megnyitva és kattintva');
                sendResponse({ success: true });
            }, 500);
            
            return true; // Keep message channel open for async response
        } else {
            console.warn('⚠️ Email elem nem található ID vagy tárgy alapján');
            sendResponse({ success: false, error: 'Email not found' });
        }
    }
    
    // Remove highlight and badge when email is deleted from priorities
    if (request.action === 'removeHighlight') {
        const emailId = request.emailId;
        console.log('🗑️ Highlight eltávolítási kérés:', emailId);
        
        // Find and remove highlighting from list item
        const emailElement = document.querySelector(`[data-convid="${emailId}"]`) ||
                            document.querySelector(`[id="${emailId}"]`) ||
                            document.querySelector(`[data-id="${emailId}"]`);
        
        if (emailElement) {
            // Remove inline styles (background, border, padding)
            emailElement.style.backgroundColor = '';
            emailElement.style.borderLeft = '';
            emailElement.style.paddingLeft = '';
            emailElement.removeAttribute('data-priority-category');
            emailElement.removeAttribute('data-priority-importance');
            emailElement.removeAttribute('data-priority-urgency');
            console.log('✅ List highlight eltávolítva:', emailId);
        }
        
        // Remove badge from Reading Pane (if currently visible)
        const existingBadge = document.querySelector('[role="main"] .eisenhower-badge');
        if (existingBadge) {
            existingBadge.parentElement?.remove();
            console.log('✅ Reading Pane badge eltávolítva');
        }
        
        sendResponse({ success: true });
        return true;
    }
});

// Quick categorization buttons helper
function createQuickActionButtons(targetEmail) {
    const categories = [
        { name: 'Do First', icon: '🔴', importance: 4, urgency: 4, color: '#ff4444' },
        { name: 'Schedule', icon: '🟡', importance: 4, urgency: 2, color: '#ffb84d' },
        { name: 'Delegate', icon: '🔵', importance: 2, urgency: 4, color: '#4499ff' },
        { name: 'Eliminate', icon: '🟢', importance: 2, urgency: 2, color: '#44bb44' }
    ];
    
    const container = document.createElement('div');
    container.className = 'eisenhower-quick-actions';
    container.style.cssText = `
        display: inline-flex;
        gap: 6px;
        margin-left: 12px;
        vertical-align: middle;
    `;
    
    categories.forEach(cat => {
        const button = document.createElement('button');
        button.className = 'eisenhower-quick-btn';
        button.textContent = cat.icon;
        button.title = cat.name;
        button.style.cssText = `
            width: 28px;
            height: 28px;
            border: 2px solid ${cat.color};
            background: ${cat.color}15;
            border-radius: 50%;
            cursor: pointer;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            padding: 0;
        `;
        
        // Hover effect
        button.addEventListener('mouseenter', () => {
            button.style.background = cat.color;
            button.style.transform = 'scale(1.15)';
            button.style.boxShadow = `0 2px 8px ${cat.color}60`;
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.background = `${cat.color}15`;
            button.style.transform = 'scale(1)';
            button.style.boxShadow = 'none';
        });
        
        // Click handler
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const emailData = extractEmailData(targetEmail);
            
            const priorityData = {
                id: emailData.id,
                subject: emailData.subject,
                importance: cat.importance,
                urgency: cat.urgency,
                timestamp: Date.now()
            };
            
            // Save to storage
            chrome.storage.local.get(['emailPriorities'], (result) => {
                const priorities = result.emailPriorities || {};
                priorities[emailData.id] = priorityData;
                chrome.storage.local.set({emailPriorities: priorities}, () => {
                    console.log('✅ Gyors kategorizálás:', cat.name);
                    
                    // Highlight the email if it's a list item
                    if (targetEmail.hasAttribute('role') && targetEmail.getAttribute('role') === 'row') {
                        highlightEmail(targetEmail, cat.importance, cat.urgency);
                    }
                    
                    showInPageNotification(`✅ ${cat.icon} ${cat.name}`);
                });
            });
        });
        
        container.appendChild(button);
    });
    
    return container;
}

// Add quick action buttons to Reading Pane badge
function addQuickActionsToReadingPane() {
    const badge = document.querySelector('[role="main"] .eisenhower-badge');
    if (!badge) return;
    
    // Check if buttons already added
    if (badge.parentElement.querySelector('.eisenhower-quick-actions')) {
        return;
    }
    
    // Get current email from Reading Pane
    const readingPaneEmail = getReadingPaneEmail();
    if (!readingPaneEmail) return;
    
    const quickActions = createQuickActionButtons(readingPaneEmail);
    badge.parentElement.appendChild(quickActions);
    
    console.log('✅ Quick action gombok hozzáadva Reading Pane-hez');
}

// Add quick action buttons to email list items on hover
function setupEmailListHoverActions() {
    // Add global styles
    if (!document.getElementById('eisenhower-hover-styles')) {
        const style = document.createElement('style');
        style.id = 'eisenhower-hover-styles';
        style.textContent = `
            .eisenhower-email-hover-container {
                position: relative;
            }
            .eisenhower-hover-actions {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                display: none;
                background: white;
                padding: 4px 8px;
                border-radius: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                z-index: 100;
            }
            .eisenhower-email-hover-container:hover .eisenhower-hover-actions {
                display: flex;
                gap: 4px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Find all email list items
    const emailListSelectors = [
        'div[role="row"][data-convid]',
        'div[role="listitem"][aria-label*="email" i]',
        'div[class*="customScrollBar"] div[role="row"]'
    ];
    
    let emailElements = [];
    for (const selector of emailListSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            emailElements = Array.from(elements);
            break;
        }
    }
    
    emailElements.forEach(emailEl => {
        // Skip if already setup
        if (emailEl.classList.contains('eisenhower-email-hover-container')) {
            return;
        }
        
        emailEl.classList.add('eisenhower-email-hover-container');
        
        // Create hover actions container
        const hoverActions = document.createElement('div');
        hoverActions.className = 'eisenhower-hover-actions';
        
        const categories = [
            { icon: '🔴', importance: 4, urgency: 4, color: '#ff4444', name: 'Do First' },
            { icon: '🟡', importance: 4, urgency: 2, color: '#ffb84d', name: 'Schedule' },
            { icon: '🔵', importance: 2, urgency: 4, color: '#4499ff', name: 'Delegate' },
            { icon: '🟢', importance: 2, urgency: 2, color: '#44bb44', name: 'Eliminate' }
        ];
        
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'eisenhower-quick-btn';
            btn.textContent = cat.icon;
            btn.title = cat.name;
            btn.style.cssText = `
                width: 24px;
                height: 24px;
                border: 2px solid ${cat.color};
                background: ${cat.color}15;
                border-radius: 50%;
                cursor: pointer;
                font-size: 12px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                padding: 0;
            `;
            
            btn.addEventListener('mouseenter', () => {
                btn.style.background = cat.color;
                btn.style.transform = 'scale(1.15)';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.background = `${cat.color}15`;
                btn.style.transform = 'scale(1)';
            });
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const emailData = extractEmailData(emailEl);
                
                const priorityData = {
                    id: emailData.id,
                    subject: emailData.subject,
                    importance: cat.importance,
                    urgency: cat.urgency,
                    timestamp: Date.now()
                };
                
                chrome.storage.local.get(['emailPriorities'], (result) => {
                    const priorities = result.emailPriorities || {};
                    priorities[emailData.id] = priorityData;
                    chrome.storage.local.set({emailPriorities: priorities}, () => {
                        highlightEmail(emailEl, cat.importance, cat.urgency);
                        showInPageNotification(`✅ ${cat.icon} ${cat.name}`);
                    });
                });
            });
            
            hoverActions.appendChild(btn);
        });
        
        emailEl.appendChild(hoverActions);
    });
    
    console.log(`✅ Hover actions hozzáadva ${emailElements.length} email elemhez`);
}

// Initialize hover actions with MutationObserver
let hoverActionsInitialized = false;
function initializeHoverActions() {
    if (hoverActionsInitialized) return;
    
    setupEmailListHoverActions();
    addQuickActionsToReadingPane();
    hoverActionsInitialized = true;
    
    // Re-run when DOM changes (new emails loaded)
    setTimeout(() => {
        hoverActionsInitialized = false;
    }, 2000);
}

// Run hover actions setup periodically
setInterval(initializeHoverActions, 3000);

// In-page notification helper
function showInPageNotification(message) {
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
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
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
    
    // Auto-remove after 3 seconds with fade out animation
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    observer.disconnect();
    console.log('👋 Content script leállítva');
});

} // End of initializeExtension()