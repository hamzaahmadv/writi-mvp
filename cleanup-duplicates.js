// Script to clean up duplicate essential pages with multiple prefixes
// Run this in browser console to fix the duplicates

const userId = 'user_2yOzcx3JE1FPTlpsl2BSgvNOgfJ';

// Get current essential pages
const essentialPagesKey = `essential-pages-${userId}`;
const stored = localStorage.getItem(essentialPagesKey);

if (stored) {
  try {
    const pages = JSON.parse(stored);
    console.log('Current pages:', pages);
    
    // Remove duplicates based on title
    const uniqueByTitle = {};
    const uniquePages = [];
    
    pages.forEach(page => {
      const baseTitle = page.title;
      
      // Keep the one with the simplest ID (least "essential-" prefixes)
      if (!uniqueByTitle[baseTitle]) {
        uniqueByTitle[baseTitle] = page;
        uniquePages.push(page);
      } else {
        // Compare IDs - keep the one with fewer "essential-" prefixes
        const currentCount = (page.id.match(/essential-/g) || []).length;
        const existingCount = (uniqueByTitle[baseTitle].id.match(/essential-/g) || []).length;
        
        if (currentCount < existingCount) {
          // Replace with simpler ID
          const index = uniquePages.findIndex(p => p.title === baseTitle);
          uniquePages[index] = page;
          uniqueByTitle[baseTitle] = page;
        }
      }
    });
    
    console.log('Unique pages:', uniquePages);
    
    // Save cleaned pages
    localStorage.setItem(essentialPagesKey, JSON.stringify(uniquePages));
    
    // Clean up orphaned localStorage entries
    const validIds = new Set(uniquePages.map(p => p.id));
    const keysToCheck = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('essential-blocks-')) {
        keysToCheck.push(key);
      }
    }
    
    keysToCheck.forEach(key => {
      // Extract the page ID from the key
      const pageId = key.replace('essential-blocks-', '');
      
      // Check if this is a valid page ID
      if (!validIds.has(pageId)) {
        // Check for double/triple prefixed versions
        const doublePrefixed = pageId.replace('essential-', '');
        const triplePrefixed = doublePrefixed.replace('essential-', '');
        
        if (!validIds.has(doublePrefixed) && !validIds.has(triplePrefixed)) {
          console.log(`Removing orphaned key: ${key}`);
          localStorage.removeItem(key);
        }
      }
    });
    
    console.log('✅ Cleanup complete! Refresh the page to see the changes.');
    
  } catch (error) {
    console.error('Error cleaning up:', error);
  }
} else {
  console.log('No essential pages found for this user');
}