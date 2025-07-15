# comment-enter-behavior.md 

You are given the following context:
$ARGUMENTS

## Comments Enter Key Behavior Implementation

Based on the comments2.md specification, implement the following behavior when a user presses Enter in the comment input:

### Requirements:

1. **Instant Submission** (Step 2 from spec):
   - Submit comment immediately on Enter key press
   - No modifier keys (Cmd/Ctrl) required
   - Comment should appear instantly in the thread above

2. **UI Updates**:
   - Clear the input field immediately
   - Keep input field focused and ready for next comment
   - No visual flicker or page refresh
   - Maintain "Add a comment..." placeholder

3. **Input Field State** (Step 3 from spec):
   - Input remains expanded and active
   - Cursor stays in the cleared input field
   - User can immediately type another comment
   - Comment thread scrolls if needed to show new comments

### Implementation Checklist:

- [ ] Enter key submits comment (no modifiers needed)
- [ ] Input field clears after submission
- [ ] Focus returns to empty input field
- [ ] Input stays expanded (doesn't collapse)
- [ ] No UI flicker during submission
- [ ] Comments appear instantly above input
- [ ] Thread scrolls if multiple comments exceed visible space

### Key Code Areas:

1. **handleKeyDown**: Should trigger submit on Enter key alone
2. **handleSubmit**: Should clear input and refocus
3. **setIsExpanded**: Should remain true after submission
4. **inputRef.current?.focus()**: Should be called after submission

This creates a seamless commenting experience where users can rapidly add multiple comments by typing and pressing Enter repeatedly.