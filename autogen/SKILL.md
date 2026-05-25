---
name: autogen
description: Triggers automatically after a successful workflow to extract, document, and save the procedure as a reusable skill.
category: memory
---

# AutoGen (Self-Evolving Loop)

## Trigger Criteria
Execute this routine internally when:
1. The user flags a workflow as successful (e.g., "It works!", "Perfect").
2. A complex task takes more than 4 iterations or multiple tool corrections to succeed.

## Procedure

### 1. Extract Pattern
* Analyze the recent chat history to identify the exact, optimized sequence of steps that led to success.
* Identify any anti-patterns (what failed initially and what to avoid).

### 2. Generate Skill File
* Create a new folder and a standard markdown file under `./skills/[skill-name]/SKILL.md`.
* Keep the content concise, direct, and under 2,000 tokens to save context window.

### 3. Required Output Structure
Every generated skill MUST include:
* **YAML Frontmatter:** `name`, `description`, and `category`.
* **When to Use:** Specific triggers and natural language context.
* **Steps:** A clean, sequential checklist for the LLM to follow.

## Rules
* Never overwrite or modify manual instructions provided directly by the user.
* Always notify the user with a brief message when a new skill has been saved to the `./skills/` directory.
