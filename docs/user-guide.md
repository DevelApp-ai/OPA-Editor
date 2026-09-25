# User Guide — Writing Policies in the OPA Rego Editor

Welcome! This guide is for **policy authors** — you do *not* need to be a
programmer or know Rego to get value out of the editor. It explains what
you see on screen, how to write a policy step by step, what the messages
mean, and what to do when something goes wrong.

> Developer documentation lives elsewhere:
> [README](../README.md) · [Domain Authoring Guide](domain-authoring-guide.md)
> · [UI Testing](ui-testing.md)

---

## What is this tool for?

Your organization uses **OPA (Open Policy Agent)** to enforce rules — for
example *"flag any cloud charge over 10,000 EUR"*. Those rules are written
as small text files called **policies** (written in a language called
**Rego**). This editor lets you write, check, and publish those policies
safely:

- it **checks your work as you type** and in plain language,
- it only lets you write rules that **make sense for your area** (your
  "domain", e.g. FinOps / cloud cost rules),
- it **stops mistakes before they go live**.

You never need to touch a server, a git repository, or a command line.

---

## The screen at a glance

When you open the editor you see four areas:

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Domain selector                                           │
├──────────────────────────────────┬───────────────────────────┤
│                                  │                           │
│  2. The policy editor            │  3. The diagnostics panel │
│     (where you type)             │     (the messages)        │
│                                  │                           │
├──────────────────────────────────┴───────────────────────────┤
│ 4. [Validate]  [Publish]  and status messages                │
└──────────────────────────────────────────────────────────────┘
```

| # | Area | What it is for |
|---|------|----------------|
| 1 | **Domain selector** | Chooses the kind of policy you are writing. If you only see one option, that is fine — your organization has set it up for you. |
| 2 | **Policy editor** | Where you type your policy. It colors the text, suggests field names while you type, and offers ready-made templates (snippets). |
| 3 | **Diagnostics panel** | Shows live feedback about your policy: problems found, what kind they are, and on which line. |
| 4 | **Action buttons** | **Validate** = "check my policy thoroughly". **Publish** = "put my policy live". The text next to the buttons tells you the outcome. |

---

## Writing your first policy, step by step

### Step 1 — Pick your domain

Use the dropdown at the top. A *domain* is the policy's subject area —
e.g. "FinOps Cost Modeling". The domain decides which fields
(`input.*` values) you can use, which rules your policy must define,
and which templates are offered.

### Step 2 — Start from the template or a snippet

The editor opens with a ready-made example policy that already follows
the rules of your domain. The safest way to write your first policy:

1. Read the example and the comments (lines starting with `#`).
2. Change only the *values* — e.g. the cost threshold `10000` or the
   service name `"AWS EC2"`.
3. While typing, accept the editor's suggestions with `Tab`. If you type
   `input.` you will see all the fields your domain allows.

### Step 3 — Understand what your policy must contain

Every domain asks for a few **required rules**. In the FinOps domain
your policy must define all three of:

| Rule | Question it answers |
|------|--------------------|
| `allow` | "Should this be allowed?" — `true` or `false` |
| `deny`  | "Should this be flagged/blocked?" — `true` or `false` |
| `report` | "What human-readable message(s) should be shown?" |

You can see which rules are required by looking at the diagnostics —
missing rules are reported automatically.

### Step 4 — Watch the diagnostics panel while you type

A few seconds after you stop typing, the panel updates:

- **✓ No issues found** — your policy passes all checks so far.
- **Diagnostics (N)** — N problems were found. Each one shows:
  - a **message** in plain language (e.g. *"input.EffectiveCost:
    undefined field"* — you used a field name the domain does not know),
  - the **line number** where it happens,
  - a colored chip for its **severity**:
    - 🔴 **error** — must be fixed before you can publish,
    - ⚪ **warning** — not blocking, but worth a look,
    - 🔵 **info** — a hint, nothing is wrong.

The panel groups messages by where they came from:

| Group | Meaning in plain words |
|-------|------------------------|
| **L1 · Schema Type** | "This field does not exist / has the wrong type for your domain." |
| **L2 · Regal Lint** | "The way this is written is not quite right — style or syntax." |
| **L3 · Domain Guard** | "Your policy breaks your domain's ground rules" (e.g. missing the `report` rule, or reading data it is not allowed to). |

### Step 5 — Press **Validate**

The live checks are quick but light. **Validate** runs the full,
authoritative check on the server (the same checks OPA itself will
apply). The button shows a spinner while it runs, then the panel shows
the complete result. Fix any 🔴 errors and press Validate again.

### Step 6 — Press **Publish**

When everything passes:

1. Press **Publish**.
2. You will see one of:
   - **✓ Published — revision abc123** — your policy is live. The
     revision is a fingerprint of exactly what was published; quote it
     if you ever need to refer to "the version we shipped".
   - **✗ Rejected — N errors** — something failed the final check. The
     panel tells you what; fix it and try again.
   - **✗ Error: …** — the publish itself could not complete (e.g. the
     server was unreachable). Nothing was changed; try again in a
     moment, and contact your platform team if it persists.

---

## Troubleshooting

| What you see | What it means | What to do |
|---|---|---|
| `Backend validation failed: …` | The checking service could not be reached. | Press **Validate** again; if it persists, contact your platform team. |
| `input.X: undefined field` | You used a field name that does not exist in your domain. | Check the spelling against the suggestions after typing `input.` — or ask for the domain's field list. |
| `missing required rule: report` | Your policy does not define a rule the domain requires. | Add the missing rule — copy its shape from the template or a snippet. |
| `package mismatch` | The first line (`package …`) does not start with the prefix your domain requires. | Keep the `package` line from the template; change only the last part. |
| `data.… reference not allowed` | Your policy reads data it is not allowed to. | Remove the reference or ask whether the domain should be extended. |
| Publish button is disabled | No domain is selected. | Pick a domain in the dropdown first. |

---

## Glossary

| Term | Plain meaning |
|------|---------------|
| **Policy** | A small text file of rules that OPA enforces. |
| **Rego** | The language policies are written in. |
| **Domain** | The subject area of your policy; decides allowed fields, required rules, and templates. |
| **Snippet** | A ready-made policy template you can insert and fill in. |
| **Validate** | Run all checks on your policy. |
| **Publish** | Make your policy live. |
| **Revision** | A fingerprint of the exact published version. |
| **OPA** | Open Policy Agent — the engine that enforces your policies. |

---

## FAQ

**Do I need to learn Rego?**
For simple policies, no — the template and snippets cover the common
cases, and you mostly change values. For anything more complex, your
platform team can pair with you.

**Can I break something by publishing?**
Only policies that pass every check can be published, and each publish
creates a new revision (nothing is silently overwritten). If a policy
misbehaves, the previous revision can be restored by your platform team.

**Where does my policy go when I publish?**
Your platform team decides — typically it is stored in git and pushed to
the OPA server, and it appears as a catalog entry so others can find it.

**I need a field or template that isn't there.**
That is a domain change, not a policy change — see the
[Domain Authoring Guide](domain-authoring-guide.md) or ask your platform
team to extend the domain.
