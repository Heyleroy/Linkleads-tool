// Background service worker for Chrome Extension Manifest V3
// This runs in the background and handles events that don't require a popup

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'INSTALL') {
    console.log('LinkLeads extension installed')
    // Open welcome page or setup page if needed
    // chrome.tabs.create({ url: chrome.runtime.getURL('src/popup/index.html') })
  }
})

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request)

  if (request.action === 'getSession') {
    chrome.storage.local.get('linkleads_session', (items) => {
      sendResponse({ session: items.linkleads_session || null })
    })
    return true // Keep channel open for async response
  }

  if (request.action === 'clearSession') {
    chrome.storage.local.remove('linkleads_session', () => {
      sendResponse({ success: true })
    })
    return true
  }
})
