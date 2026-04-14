# bash completion for Psysonic (see `psysonic --help`).
# Install: source /path/to/completions/psysonic.bash
# Optional: jq + prior `psysonic --player audio-device list` for device name completion.
#
# Uses no `mapfile` so bash 3.2 (macOS default) works.

_psysonic_compreply_from_compgen() {
  # $1 = compgen -W word list, $2 = current word
  COMPREPLY=()
  local line
  while IFS= read -r line; do
    [[ -n $line ]] && COMPREPLY+=("$line")
  done < <(compgen -W "$1" -- "$2")
}

_psysonic_audio_device_json() {
  local f
  if [[ -n ${XDG_RUNTIME_DIR:-} ]]; then
    f="$XDG_RUNTIME_DIR/psysonic-cli-audio-devices.json"
    [[ -r $f ]] && { printf '%s' "$f"; return; }
  fi
  f="${TMPDIR:-/tmp}/psysonic-cli-audio-devices.json"
  [[ -r $f ]] && printf '%s' "$f"
}

_psysonic_library_json() {
  local f
  if [[ -n ${XDG_RUNTIME_DIR:-} ]]; then
    f="$XDG_RUNTIME_DIR/psysonic-cli-library.json"
    [[ -r $f ]] && { printf '%s' "$f"; return; }
  fi
  f="${TMPDIR:-/tmp}/psysonic-cli-library.json"
  [[ -r $f ]] && printf '%s' "$f"
}

_psysonic_complete() {
  local cur
  cur="${COMP_WORDS[COMP_CWORD]}"

  local i pidx=0
  for (( i = 1; i < COMP_CWORD; i++ )); do
    [[ ${COMP_WORDS[i]} == --player ]] && pidx=$i
  done

  if (( pidx == 0 )); then
    if [[ ${COMP_WORDS[1]} == completions && COMP_CWORD -eq 2 ]]; then
      _psysonic_compreply_from_compgen 'help bash zsh' "$cur"
      return
    fi
    _psysonic_compreply_from_compgen '--help --version --info --json --quiet --player completions' "$cur"
    return
  fi

  local -a sub=()
  for (( i = pidx + 1; i < COMP_CWORD; i++ )); do
    sub+=("${COMP_WORDS[i]}")
  done
  local n=${#sub[@]}

  if (( n == 0 )); then
    _psysonic_compreply_from_compgen 'next prev play pause seek volume audio-device library mix' "$cur"
    return
  fi

  case ${sub[0]} in
    audio-device)
      if (( n == 1 )); then
        _psysonic_compreply_from_compgen 'list set' "$cur"
      elif [[ ${sub[1]} == set ]] && (( n == 2 )); then
        COMPREPLY=()
        local jf d
        jf="$(_psysonic_audio_device_json)"
        if [[ -n $jf ]] && command -v jq &>/dev/null; then
          while IFS= read -r d; do
            [[ -n $d && $d == "$cur"* ]] && COMPREPLY+=("$d")
          done < <(jq -r '.devices[]? | select(type == "string")' "$jf" 2>/dev/null)
        fi
        while IFS= read -r line; do
          [[ -n $line ]] && COMPREPLY+=("$line")
        done < <(compgen -W 'default' -- "$cur")
        ((${#COMPREPLY[@]})) && compopt -o filenames 2>/dev/null
      fi
      ;;
    library)
      if (( n == 1 )); then
        _psysonic_compreply_from_compgen 'list set' "$cur"
      elif [[ ${sub[1]} == set ]] && (( n == 2 )); then
        COMPREPLY=()
        local jf id line
        jf="$(_psysonic_library_json)"
        if [[ -n $jf ]] && command -v jq &>/dev/null; then
          while IFS= read -r id; do
            [[ -n $id && $id == "$cur"* ]] && COMPREPLY+=("$id")
          done < <(jq -r '.folders[]? | select(.id != null) | .id | tostring' "$jf" 2>/dev/null)
        fi
        while IFS= read -r line; do
          [[ -n $line ]] && COMPREPLY+=("$line")
        done < <(compgen -W 'all' -- "$cur")
        ((${#COMPREPLY[@]})) && compopt -o filenames 2>/dev/null
      fi
      ;;
    mix)
      (( n == 1 )) && _psysonic_compreply_from_compgen 'append new' "$cur"
      ;;
    seek|volume)
      (( n == 1 )) && compopt -o default && COMPREPLY=()
      ;;
  esac
}

complete -F _psysonic_complete psysonic
