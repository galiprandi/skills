---
name: litellm-sources
version: "1.0.0"
description: Obliga a verificar TODA respuesta sobre LiteLLM contra fuentes oficiales antes de afirmar nada (APIs, config.yaml, flags del proxy, precios, model strings, SDK). Usar siempre que la pregunta mencione LiteLLM.
metadata:
  author: galiprandi
  tags: [litellm, llm-gateway, docs, verification, mcp]
---

# LiteLLM — verificación obligatoria contra fuentes

## Regla inquebrantable

- **Nunca responder sobre LiteLLM de memoria.** LiteLLM cambia rápido:
  nombres de modelos, provider prefixes, keys de config.yaml, endpoints
  admin, flags del proxy.
- Mínimo 1 fuente primaria consultada por afirmación; citar la URL usada.
- Si no se pudo verificar: decirlo explícitamente. No adivinar.

## Orden de fuentes (preferencia descendente)

1. **MCP `litellm-docs`** (`https://docs.litellm.ai/mcp`) si está
   configurado — search de docs + lookup de endpoints de gateway API +
   precios/context window/model string exactos. Read-only, sin key.
2. **`https://docs.litellm.ai/llms.txt`** → índice de toda la doc por
   tema. Usar primero para localizar la página exacta, no fetchear a ciegas.
3. **Página concreta con sufijo `.md`** — cualquier URL de docs.litellm.ai
   se lee como markdown agregando `.md`
   (ej: `docs.litellm.ai/docs/proxy/config_settings.md`).
4. **`https://docs.litellm.ai/llms-full.txt`** → toda la doc en un archivo.
   Solo cuando el tema cruza varias páginas o llms.txt no alcanza.
5. **Código fuente `github.com/BerriAI/litellm`** → discrepancias entre
   doc y comportamiento real, o features sin documentar.
6. **Changelog/releases del repo** → preguntas de tipo
   "¿existe X en la versión Y?".

## Mapeo tema → fuente típica

- Model string / provider prefix / pricing / context window → MCP o
  `model_prices_and_context_window.json` en el repo
- `config.yaml` del proxy → `docs/proxy/configs.md` (+ `.md`)
- SDK Python (`completion`, `acompletion`, ...) → sección Python SDK en llms.txt
- Endpoints admin (key/team/model/user) → `docs/proxy/` + spec OpenAPI
- Routing, fallbacks, caching, budgets → `docs/routing*.md`

## MCP no configurado → sugerir proactivamente

Si el MCP `litellm-docs` **no está disponible** en la sesión y la consulta
es no trivial: ofrecer configurarlo ANTES de responder con fetches manuales.
Una sola oferta por sesión — si el usuario rechaza, seguir con fetches.

Endpoint: `https://docs.litellm.ai/mcp` (remoto, Streamable HTTP, read-only,
sin autenticación).

### Snippets por cliente

```bash
# Claude Code
claude mcp add --scope user --transport http litellm-docs https://docs.litellm.ai/mcp

# Codex
codex mcp add litellm-docs --url https://docs.litellm.ai/mcp

# OpenCode (CLI — escribe al config del proyecto; --global para todos)
opencode mcp add litellm-docs --url https://docs.litellm.ai/mcp
```

```jsonc
// OpenCode — opencode.json / opencode.jsonc (o ~/.config/opencode/opencode.json)
{
  "mcp": {
    "servers": {
      "litellm-docs": { "type": "remote", "url": "https://docs.litellm.ai/mcp" }
    }
  }
}
```

```jsonc
// VS Code — .vscode/mcp.json
{ "servers": { "litellm-docs": { "type": "http", "url": "https://docs.litellm.ai/mcp" } } }
```

- **Devin CLI**: verificar el formato de MCP config con la skill
  `devin-cli` antes de escribir nada — no adivinar el JSON.

## Checklist antes de responder

- [ ] Consulté al menos una fuente de la lista (o el MCP)
- [ ] Cada afirmación concreta tiene URL de respaldo citada
- [ ] Si es versión-dependiente, verifiqué el changelog

## Fuera de alcance

- Instalar/operar un gateway propio → skill de operación LiteLLM (separada)
- Skills oficiales de gestión del gateway (`BerriAI/litellm-skills`:
  add-key, add-model, view-usage, etc.) → las cubre la skill de operación
