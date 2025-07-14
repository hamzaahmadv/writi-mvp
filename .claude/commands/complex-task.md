# Complex Task Framework

A structured approach for tackling complex development tasks.

## Usage
```
/complex-task <task_description>
```

## Framework: Explore → Plan → Code

### 🔍 EXPLORE
Research the codebase to understand existing patterns, architecture, and dependencies before starting any work.

### 📋 PLAN  
Create a structured todo list breaking the task into manageable steps with clear priorities and dependencies.

### 💻 CODE
Implement systematically following project conventions with regular quality checks.

## Command Implementation

Execute the following steps when this command is invoked:

### Phase 1: EXPLORE 🔍

1. **Understand the Task Context**
   ```
   Analyze the provided task description and identify:
   - Core functionality requirements
   - UI/UX components needed
   - Data/state management requirements
   - Integration points with existing features
   ```

2. **Research Existing Codebase**
   ```
   Use Task tool to search for:
   - Similar existing features or components
   - Relevant hooks, utilities, and patterns
   - Database schema implications
   - Authentication/authorization considerations
   ```

3. **Architecture Analysis**
   ```
   Review:
   - Project structure and conventions (check CLAUDE.md)
   - Existing patterns for similar functionality
   - Component hierarchy and data flow
   - API patterns and server actions
   ```

4. **Dependency Discovery**
   ```
   Identify:
   - Required new dependencies vs existing ones
   - Shared components that can be leveraged
   - Database schema changes needed
   - Storage/external service integrations
   ```

### Phase 2: PLAN 📋

5. **Create Structured Task List**
   ```
   Use TodoWrite tool to create tasks covering:
   - Database schema updates (if needed)
   - Server action implementation
   - Component creation/modification
   - Hook development
   - Integration and testing
   - Quality assurance steps
   ```

6. **Task Prioritization and Sequencing**
   ```
   Order tasks logically:
   - Infrastructure first (DB, types, schemas)
   - Core functionality second (hooks, actions)
   - UI components third
   - Integration and polish fourth
   - Quality checks last
   ```

7. **Define Success Criteria**
   ```
   For each task, identify:
   - Specific deliverables
   - Testing requirements
   - Performance considerations
   - User experience goals
   ```

### Phase 3: CODE 💻

8. **Systematic Implementation**
   ```
   Execute tasks in order:
   - Mark each task as "in_progress" before starting
   - Implement following project conventions
   - Test incrementally where possible
   - Mark tasks as "completed" when finished
   ```

9. **Quality Assurance Checkpoints**
   ```
   After major milestones, run:
   - npm run type-check
   - npm run lint
   - npm run build (if appropriate)
   - Manual testing of functionality
   ```

10. **Integration Verification**
    ```
    Ensure:
    - All components work together properly
    - No breaking changes to existing functionality
    - Performance is acceptable
    - Code follows project patterns
    ```

## Best Practices

### During EXPLORE:
- Use multiple search strategies (Grep, Glob, Task tool)
- Read CLAUDE.md thoroughly for project-specific guidance
- Look for edge cases and error scenarios
- Consider mobile/responsive requirements

### During PLAN:
- Break large tasks into <2 hour chunks
- Include error handling and loading states
- Plan for both optimistic and pessimistic paths
- Consider accessibility requirements

### During CODE:
- Update todos frequently and honestly
- Run quality checks early and often
- Write self-documenting code
- Test edge cases as you go

## Example Usage

```
/complex-task "Add real-time collaborative editing to blocks with cursor positions and live typing indicators"
```

This would trigger the full Explore → Plan → Code cycle for implementing a complex real-time collaboration feature.

## Expected Outcomes

- **Systematic approach** to complex problems
- **Reduced oversight** of important considerations  
- **Higher quality** implementations following project patterns
- **Better planning** leading to more efficient execution
- **Consistent methodology** across different types of tasks

---

*This command provides structure for complex development work while maintaining flexibility for different types of tasks.*



