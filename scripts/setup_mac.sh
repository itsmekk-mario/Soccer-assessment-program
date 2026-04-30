#!/usr/bin/env zsh
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3가 필요합니다. macOS Command Line Tools 또는 Python 3.10+을 설치하세요."
  exit 1
fi

python3 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip setuptools wheel

# Apple Silicon에서는 CUDA가 아니라 torch MPS 또는 CPU를 사용합니다.
python -m pip install torch torchvision torchaudio
python -m pip install -e .

echo ""
echo "설치 완료"
echo "다음 명령으로 MPS를 확인하세요:"
echo "source .venv/bin/activate && python -m soccer_ai_mvp.check_mps"

