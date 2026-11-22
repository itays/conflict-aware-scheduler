#!/usr/bin/env bash
# Launch, check and tear down an isolated Conflict-Aware Scheduler dev server.
#
#   verify.sh launch            start a server on a free port, print RUN_ID and URL
#   verify.sh doctor RUN_ID     read-only health check of that instance
#   verify.sh url RUN_ID        print the instance's base URL
#   verify.sh cleanup RUN_ID    stop the instance and drop its state (keeps evidence)
#   verify.sh cleanup --all     same, for every instance this script started
set -euo pipefail

REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
STATE_ROOT="${TMPDIR:-/tmp}/conflict-scheduler-verify"
ARTIFACT_ROOT="$REPO/verify-artifacts"

die() { echo "verify: $*" >&2; exit 1; }

state_dir() {
  [[ -n "${1:-}" ]] || die "missing RUN_ID"
  local dir="$STATE_ROOT/$1"
  [[ -d "$dir" ]] || die "no instance with RUN_ID $1 (state dir $dir missing)"
  echo "$dir"
}

free_port() {
  node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
}

launch() {
  local run_id="${RUN_ID:-$(date +%Y%m%d-%H%M%S)-$$}"
  local dir="$STATE_ROOT/$run_id"
  mkdir -p "$dir" "$ARTIFACT_ROOT/$run_id"
  local port
  port="$(free_port)"
  echo "$port" >"$dir/port"
  git -C "$REPO" rev-parse --short HEAD >"$dir/rev"
  git -C "$REPO" status --porcelain | grep -q . && echo dirty >>"$dir/rev"

  # Own process group, so cleanup can stop the server and anything it spawned.
  set -m
  (cd "$REPO" && exec ./node_modules/.bin/vite dev --host 127.0.0.1 \
    --port "$port" --strictPort) >"$dir/server.log" 2>&1 &
  echo $! >"$dir/pid"
  set +m

  local url="http://127.0.0.1:$port"
  for _ in $(seq 1 120); do
    if curl -fsSL "$url/" 2>/dev/null | grep -q "<title>Scheduler</title>"; then
      echo "RUN_ID=$run_id"
      echo "URL=$url"
      echo "ARTIFACTS=$ARTIFACT_ROOT/$run_id"
      return 0
    fi
    kill -0 "$(cat "$dir/pid")" 2>/dev/null || {
      cat "$dir/server.log" >&2
      die "server exited during startup"
    }
    sleep 0.5
  done
  cat "$dir/server.log" >&2
  die "server not ready after 60s (RUN_ID=$run_id; run cleanup)"
}

doctor() {
  local dir pid port url ok=0
  dir="$(state_dir "${1:-}")"
  pid="$(cat "$dir/pid")"
  port="$(cat "$dir/port")"
  url="http://127.0.0.1:$port"
  check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; ok=1; fi; }

  check "server process $pid is running" "kill -0 $pid 2>/dev/null"
  check "port $port is held by our process group" \
    "lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>/dev/null | xargs -I{} ps -o pgid= -p {} | grep -qw $pid"
  check "GET / serves the Scheduler page" \
    "curl -fsSL '$url/' | grep -q '<title>Scheduler</title>'"
  echo "info built from $(tr '\n' ' ' <"$dir/rev")(current HEAD $(git -C "$REPO" rev-parse --short HEAD); dev server serves the working tree)"
  echo "info url $url"
  echo "info log $dir/server.log"
  return $ok
}

cleanup_one() {
  local dir="$1" pid
  pid="$(cat "$dir/pid" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid"
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -KILL -- "-$pid" 2>/dev/null || true
  fi
  rm -rf "$dir"
  echo "stopped $(basename "$dir"); evidence kept in $ARTIFACT_ROOT/$(basename "$dir")"
}

case "${1:-}" in
  launch) launch ;;
  doctor) doctor "${2:-}" ;;
  url) echo "http://127.0.0.1:$(cat "$(state_dir "${2:-}")/port")" ;;
  cleanup)
    if [[ "${2:-}" == "--all" ]]; then
      for dir in "$STATE_ROOT"/*/; do [[ -d "$dir" ]] && cleanup_one "${dir%/}"; done
    else
      cleanup_one "$(state_dir "${2:-}")"
    fi
    ;;
  *) sed -n '2,9p' "$0"; exit 2 ;;
esac
