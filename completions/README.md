# Shell completion for `psysonic`

Covers global flags (`--help`, `--info`, …), `completions …`, and `--player` commands (`next`, `audio-device …`, `library …`, `mix …`, …). Run `psysonic --help` for the full list.

The same scripts are **embedded in the release binary**: run **`psysonic completions`** for install instructions, or **`psysonic completions bash` / `zsh`** to print the scripts (no repo checkout needed).

## zsh

Copy or symlink `_psysonic` into a directory on your `$fpath`, then reload completion:

```sh
mkdir -p ~/.zsh/completions
ln -sf /path/to/psysonic/completions/_psysonic ~/.zsh/completions/_psysonic
fpath=(~/.zsh/completions $fpath)
autoload -Uz compinit && compinit
```

If you use a plugin manager, point its `fpath` at this repo’s `completions/` directory instead.

## bash

Source the script once (e.g. in `~/.bashrc`):

```sh
source /path/to/psysonic/completions/psysonic.bash
```

Use this only under **bash** (including macOS’s `/bin/bash` 3.2). **zsh** users should install `_psysonic` instead — do not `source` the `.bash` file in zsh.

## Device names after `audio-device set`

Completion can suggest IDs from `psysonic-cli-audio-devices.json` (same paths the app uses: `$XDG_RUNTIME_DIR` or `$TMPDIR`/`/tmp`). That file appears after you run **`psysonic --player audio-device list`** while the app is running. Optional: install **`jq`** for parsing that JSON in the completion scripts.

## Folder ids after `library set`

Same idea with **`psysonic-cli-library.json`**, produced by **`psysonic --player library list`**. Optional **`jq`** for completion of folder ids plus the literal **`all`**.
