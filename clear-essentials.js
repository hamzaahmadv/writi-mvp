// Script to clear essential pages from localStorage
// Run this in browser console to test the fix

const userId = 'user_2yOzcx3JE1FPTlpsl2BSgvNOgfJ';

// Clear essential pages list
localStorage.removeItem(`essential-pages-${userId}`);

// Clear all essential blocks
const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && key.startsWith('essential-blocks-')) {
    keysToRemove.push(key);
  }
  if (key && key.startsWith('writi-welcome-created-essential-')) {
    keysToRemove.push(key);
  }
}

keysToRemove.forEach(key => {
  localStorage.removeItem(key);
  console.log(`Removed: ${key}`);
});

console.log('✅ Cleared all essential pages from localStorage');
console.log('Refresh the page to see the fix in action');