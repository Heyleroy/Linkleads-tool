// Content script that runs on LinkedIn pages
// This can be used to extract profile information or inject UI elements

console.log('LinkLeads content script loaded on:', window.location.href)

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request)

  if (request.action === 'getProfileInfo') {
    // Extract LinkedIn profile information from the page
    const profileInfo = extractProfileInfo()
    sendResponse({ profileInfo })
  }
})

function extractProfileInfo() {
  // This is a placeholder - you'll need to expand this based on LinkedIn's structure
  const profileName = document.querySelector('[data-test-id="top-card-profile-headline"]')?.textContent || null
  const profileHeadline = document.querySelector('.top-card-headline')?.textContent || null

  return {
    name: profileName,
    headline: profileHeadline,
    url: window.location.href,
  }
}

// Inject a button or badge that can be clicked to trigger the lookup
function injectLookupWidget() {
  const widget = document.createElement('div')
  widget.id = 'linkleads-widget'
  widget.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    color: white;
    font-weight: bold;
    font-size: 24px;
  `
  widget.textContent = '🔗'
  widget.title = 'LinkLeads Lookup'

  widget.addEventListener('click', () => {
    console.log('LinkLeads widget clicked')
    // Trigger lookup logic
  })

  document.body.appendChild(widget)
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectLookupWidget)
} else {
  injectLookupWidget()
}
