---
layout: default
title: OPA Rego Editor for Backstage
---

# OPA Rego Editor for Backstage

**Domain-scoped OPA Rego policy editor plugin for Backstage**

[![CI](https://github.com/DevelApp-ai/OPA-Editor/actions/workflows/ci.yml/badge.svg)](https://github.com/DevelApp-ai/OPA-Editor/actions/workflows/ci.yml)
[![UI Screenshots](https://github.com/DevelApp-ai/OPA-Editor/actions/workflows/ui-screenshots.yml/badge.svg)](https://github.com/DevelApp-ai/OPA-Editor/actions/workflows/ui-screenshots.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/DevelApp-ai/OPA-Editor/blob/main/LICENSE)

The OPA Rego Editor is a Backstage plugin that lets policy authors write
Rego policies in a Monaco-based editor scoped to a specific domain
(e.g. FinOps cost modeling via FOCUS), with live validation,
schema-driven completion, and one-click publish to OPA.

For the full project overview, see the
[README](README) — this page is the documentation hub for the site.

## 📚 Documentation

- [User Guide](docs/user-guide) — writing policies in the editor, for policy authors (non-technical)
- [Domain Authoring Guide](docs/domain-authoring-guide) — creating a new domain package, for developers
- [UI Testing with Screenshots](docs/ui-testing) — how the UI is tested with screenshots, and how they are published into the docs
- [API Reference](docs/api-reference) — generated API documentation
- [Design Specification](docs/opa-editor-backstage-design-spec) — full technical design specification

## 🖥️ UI Documentation

The UI is tested with screenshots on every push — the PNGs are published
into the documentation under `docs/images/` and embedded in the
[User Guide](docs/user-guide).

## 🤝 Contributing

See [CONTRIBUTING](https://github.com/DevelApp-ai/OPA-Editor/blob/main/CONTRIBUTING.md)
on GitHub.
