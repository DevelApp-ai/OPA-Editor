# Domain Authoring Guide

This guide explains how to create a new domain package for the OPA Rego Editor.
A domain package provides the JSON Schema, structural rules, and editor snippets
that scope the Rego editor to a specific problem space.

## What is a domain?
A domain is a scoping mechanism that constrains what a Rego policy may reference.
1. JSON Schema (defines input shape)
2. Domain guard (TypeScript structural rules)
3. Snippets (Monaco templates)

## Step 1: Create the package
mkdir -p packages/domain-mydomain/src/schemas

## Step 2: Define the JSON Schema
### Step 3: Implement the domain guard
### Step 4: Add snippet templates
## Step 5: Wire the public API
## Step 6: Write tests
## Step 7: Register in Backstage
## Checklist

For full details, run `npx https://github.com/DevelApp-ai/OPA-Editor.git` and se docs/domain-authoring-guide.md.