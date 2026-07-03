// Content script that runs on LinkedIn pages
// This script detects profile pages, scrapes data, and injects a lookup button

interface LinkedInProfileData {
  name: string | null
  headline: string | null
  company: string | null
  location: string | null
  url: string
  timestamp: number
}

// LinkedIn profile URL pattern
const isLinkedInProfile = (): boolean => {
  return /linkedin\.com\/in\//.test(window.location.href)
}

// Utility function to safely query elements
const querySelector = (selector: string): string | null => {
  try {
    const element = document.querySelector(selector)
    return element?.textContent?.trim() || null
  } catch (err) {
    console.error(`Error querying selector ${selector}:`, err)
    return null
  }
}

// Extract profile data from the page
const extractProfileData = (): LinkedInProfileData => {
  // Name - typically in h1.text-heading-xlarge or similar top card element
  const name =
    querySelector('h1') ||
    querySelector('[data-test-id="top-card-headline"]') ||
    querySelector('.top-card h1') ||
    querySelector('.gh-headline')

  // Headline - typically in the first h3 or data-testid element
  const headline =
    querySelector('.text-body-medium.break-words') ||
    querySelector('[data-test-id="profile-headline"]') ||
    querySelector('.top-card-headline') ||
    querySelector('.headline')

  // Company - look for company link or text
  const company =
    querySelector('a[href*="company"]') ||
    querySelector('[data-test-id="experience-item"]') ||
    querySelector('.experience-item__company')

  // Location - often in a specific section
  const location =
    querySelector('[data-test-id="profile-location"]') ||
    querySelector('.profile-location') ||
    querySelector('h3 + p')

  return {
    name,
    headline,
    company,
    location,
    url: window.location.href,
    timestamp: Date.now(),
  }
}

// Wait for page to load and elements to be available
const waitForProfileLoad = (maxAttempts = 10, interval = 500): Promise<void> => {
  return new Promise((resolve) => {
    let attempts = 0

    const checkForElements = () => {
      attempts++

      // Check if main profile heading exists
      const profileHeading = document.querySelector('h1')
      if (profileHeading || attempts >= maxAttempts) {
        resolve()
      } else {
        setTimeout(checkForElements, interval)
      }
    }

    checkForElements()
  })
}

// Create and inject the floating button
const injectLookupButton = (): void => {
  // Check if button already exists
  if (document.getElementById('linkleads-enrich-button')) {
    return
  }

  const button = document.createElement('div')
  button.id = 'linkleads-enrich-button'
  button.setAttribute('role', 'button')
  button.setAttribute('tabindex', '0')
  button.setAttribute('aria-label', 'Enrich profile with LinkLeads')

  // Style the button
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    width: auto;
    padding: 12px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  `

  button.innerHTML = '🔗 Enrich with LinkLeads'

  // Add hover effect
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)'
    button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)'
  })

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)'
    button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
  })

  button.addEventListener('click', handleEnrichClick)
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleEnrichClick()
    }
  })

  document.body.appendChild(button)
  console.log('[LinkLeads] Button injected successfully')
}

// Handle button click
const handleEnrichClick = (): void => {
  console.log('[LinkLeads] Enrich button clicked')

  const profileData = extractProfileData()
  console.log('[LinkLeads] Extracted profile data:', profileData)

  // Send message to background service worker
  chrome.runtime.sendMessage(
    {
      action: 'enrichProfile',
      data: profileData,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('[LinkLeads] Error sending message:', chrome.runtime.lastError)
      } else {
        console.log('[LinkLeads] Background response:', response)
        showSuccessNotification()
      }
    }
  )
}

// Show success notification
const showSuccessNotification = (): void => {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10001;
    background: #4ade80;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease;
  `
  notification.textContent = '✓ Profile data sent to LinkLeads'

  // Add animation
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `
  document.head.appendChild(style)

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.style.opacity = '0'
    notification.style.transition = 'opacity 0.3s ease'
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[LinkLeads] Content script received message:', request)

  if (request.action === 'getProfileInfo') {
    const profileData = extractProfileData()
    sendResponse({ success: true, data: profileData })
  }
})

// Initialize content script
const init = async (): Promise<void> => {
  console.log('[LinkLeads] Content script loaded on:', window.location.href)

  if (!isLinkedInProfile()) {
    console.log('[LinkLeads] Not a LinkedIn profile page, exiting')
    return
  }

  console.log('[LinkLeads] Detected LinkedIn profile page')

  // Wait for page to load
  await waitForProfileLoad()
  console.log('[LinkLeads] Page load detected')

  // Inject button
  injectLookupButton()
}

// Run initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
