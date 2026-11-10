# Shell Snippets

Rebuild and reinstall the app locally:

```bash
make build
make install
```

Check what the download page is actually serving:

```bash
curl -sI https://downloads.shadynotes.app/macos/ShadyNotes.dmg \
  | grep -i cache-control
```
