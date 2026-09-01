[Back to README](../README.md)

# Release checklist

## Перед версией

- Убедиться, что `package.json` содержит корректные `name`, `version`, `license` и `engines`.
- Обновить версию по SemVer и зафиксировать user-facing изменения в release notes.
- Проверить, что `LICENSE` содержит текст MIT и `README.md` соответствует публичному API.
- Не включать в пакет `.env`, локальные логи, coverage и AI Factory артефакты.

## Проверки

```bash
npm run format:check
npm run typecheck
npm test
npm run test:package
npm run pack:check
```

`test:package` сначала собирает `dist/`, затем проверяет root, HTTP и type-only entry
points, их декларации и отсутствие Node-only imports в runtime-agnostic core.

`pack:check` выполняет `npm pack --dry-run --json`: проверьте список файлов перед
фактической публикацией. В нём должны быть `dist/`, `LICENSE`, `README.md` и `package.json`.

## Публикация

- Выполнить публикацию из чистого commit на поддерживаемой версии Node.js.
- Проверить выбранный tag (`latest`, `next` и другие) и public access.
- При поддержке registry включить provenance для publish command.
- После публикации установить пакет в чистом consumer-проекте и проверить root и
  `@abarbonov/structured-logger/http` imports.

## See Also

- [README](../README.md) — установка, usage и exporters.
- [Package scripts](../package.json) — команды сборки и проверок.
