# AI Development Rules — DevsFTP

## Core Principle
**DevsFTP is an evolving product, not a disposable code-generation exercise.**
The AI assistant's job is to improve what exists. Do not destroy working functionality to make the next task easier. Do not redesign the product while implementing a feature. Do not blame existing code without empirical evidence. Work autonomously, but strictly inside the established engineering boundaries.

---

## 1. Mandatory Pre-Coding Check Sequence
Before beginning any feature implementation, bug fix, UI work, refactor, or architectural change:
1. **READ THE DEVELOPMENT RULES FIRST**:
   - `AI_RULES.md`
   - `ARCHITECTURE_RULES.md`
   - `UI_RULES.md`
   - `CHANGE_RULES.md`
   - `TESTING_RULES.md`
2. **INSPECT EXISTING IMPLEMENTATION**: Thoroughly inspect the existing code in `src/main/` and `src/renderer/` relevant to the task before writing or editing any code. Do not begin coding based solely on prompt instructions.

---

## 2. Protection of Existing Working Code
- Existing working code is presumed intentional.
- Do **NOT** automatically replace or rewrite existing working code because:
  - A new implementation is easier
  - A different architecture is cleaner
  - The existing code is older or inconvenient
  - Rewriting requires less effort
- When a new feature introduces an issue, investigate the new code first. Do not blame existing code without empirical evidence.

---

## 3. Incremental Build-Forward Strategy
DevsFTP must evolve incrementally:
```text
existing functionality + new functionality = expanded functionality
```
Avoid rewrites unless there is an explicit, demonstrated architectural requirement. Preserve working systems and extend them.

---

## 4. Required Development Sequence
For every substantial task, follow this exact workflow:
```text
READ RULES
    ↓
INSPECT EXISTING IMPLEMENTATION
    ↓
IDENTIFY EXISTING PATTERNS
    ↓
PLAN THE SMALLEST APPROPRIATE CHANGE
    ↓
IMPLEMENT
    ↓
TEST NEW FUNCTIONALITY
    ↓
TEST AFFECTED EXISTING FUNCTIONALITY
    ↓
CHECK UI CONSISTENCY
    ↓
REVIEW DIFF FOR UNRELATED CHANGES
    ↓
REPORT RESULT
```

---

## 5. Conflict Resolution & Escalation
If a requested feature conflicts with an existing rule, architecture, or working behavior:
1. Identify the specific conflict immediately.
2. Explain the technical conflict to the owner.
3. Determine if the feature can be implemented without violating existing systems.
4. Stop and escalate the conflict rather than redesigning the project autonomously.
