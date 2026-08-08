typeset -g VINCU_SHELL_INTEGRATION_DIR="${${(%):-%N}:A:h}"

if [[ -n "${VINCU_ZSH_ZDOTDIR-}" ]]; then
  export ZDOTDIR="${VINCU_ZSH_ZDOTDIR}"
else
  unset ZDOTDIR
fi

if [[ -n "${ZDOTDIR-}" ]]; then
  if [[ -f "${ZDOTDIR}/.zshenv" ]]; then
    source "${ZDOTDIR}/.zshenv"
  fi
elif [[ -f "${HOME}/.zshenv" ]]; then
  source "${HOME}/.zshenv"
fi

source "${VINCU_SHELL_INTEGRATION_DIR}/vincu-integration.zsh"
