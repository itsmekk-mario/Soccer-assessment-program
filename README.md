# Soccer Assessment Program

학교 축구부와 아마추어 경기 영상을 기록하고 분석하기 위한 Python 기반 MVP입니다. 목표는 상용 프로급 전술 분석이 아니라, MacBook에서 경기 영상을 처리해 선수 위치 추적, 2D 미니맵, 간단한 통계, CSV, Markdown 리포트, 포트폴리오/인스타용 결과 영상을 만드는 것입니다.

## 프로젝트 방향

- 초기 분석 장비는 M2 MacBook Air입니다.
- RTX 3060 PC, Jetson Orin Nano Super, 실시간 중계 배포는 후속 단계로 미룹니다.
- 우선 영상 파일을 받아 오프라인으로 분석합니다.
- YOLO 경량 모델로 사람 선수를 검출합니다.
- tracker로 선수 ID를 유지합니다.
- 화면 밖 선수는 정확 좌표가 아니라 `lost` 또는 `out_of_view` 저신뢰 상태로 유지합니다.
- FIFA 공인 규격에 가까운 `105 x 68m` 피치 모델을 사용합니다.
- 흰선 자동 검출보다 수동 기준점 보정을 먼저 목표로 합니다.

## 현재 MVP 기능

- 영상 입력: `mp4`, `mov` 등 OpenCV가 읽을 수 있는 영상
- 선수 검출: Ultralytics YOLO `person` class
- 선수 ID 유지: Ultralytics tracking + ByteTrack 설정
- 상태 관리:
  - `visible`: 현재 프레임에서 검출됨
  - `lost`: 최근에는 보였지만 잠시 가려졌거나 검출 실패
  - `out_of_view`: 오래 보이지 않아 화면 밖으로 나간 것으로 처리
- 2D 미니맵: 경기장 위에 선수 위치를 표시
- 결과 저장:
  - `annotated.mp4`: bbox, ID, 상태, 미니맵이 들어간 결과 영상
  - `tracks.csv`: 프레임별 선수 좌표/상태 기록
  - `report.md`: 간단 분석 리포트

## 폴더 구조

```text
soccer_ai_mvp/
  configs/
    default.yaml              # 피치 크기, tracking, render 설정
  data/
    input/                    # 분석할 영상 배치
    output/                   # 결과 영상/CSV/리포트 저장
  scripts/
    setup_mac.sh              # macOS 설치 스크립트
  src/soccer_ai_mvp/
    cli.py                    # 분석 실행 진입점
    check_mps.py              # PyTorch MPS 사용 가능 여부 확인
    config.py                 # YAML 설정 로더
    devices.py                # auto/mps/cpu 선택
    homography.py             # 화면 좌표 -> 피치 좌표 변환
    render.py                 # bbox/미니맵 렌더링
    report.py                 # CSV/Markdown 리포트 저장
    state.py                  # 선수 상태 visible/lost/out_of_view 관리
    team_color.py             # MVP용 단순 유니폼 색 힌트
  web_prototype/
    index.html                # 브라우저 UI 프로토타입
    app.js
    styles.css
```

## MacBook 설치

Python 3.9 이상에서 실행됩니다. macOS 기본 Python 3.9.6도 지원하도록 설정했습니다.

```sh
cd /Users/guest-dangn/soccer_ai_mvp
zsh scripts/setup_mac.sh
```

설치 스크립트가 하는 일:

- `.venv` 생성
- `pip`, `setuptools`, `wheel` 업데이트
- `torch`, `torchvision`, `torchaudio` 설치
- 이 프로젝트를 editable 모드로 설치
- `ultralytics`, `opencv-python`, `numpy`, `pandas`, `pyyaml`, `tqdm` 설치

## MPS 확인

Apple Silicon에서는 CUDA가 아니라 PyTorch MPS 또는 CPU를 사용합니다.

```sh
cd /Users/guest-dangn/soccer_ai_mvp
source .venv/bin/activate
python -m soccer_ai_mvp.check_mps
```

출력에서 `MPS available: True`가 나오면 `--device auto`가 `mps`를 선택합니다. 사용할 수 없으면 자동으로 `cpu`를 사용합니다.

## 분석 실행

분석할 영상을 `data/input/match.mp4`에 넣은 뒤 실행합니다.

```sh
cd /Users/guest-dangn/soccer_ai_mvp
source .venv/bin/activate
python -m soccer_ai_mvp.cli \
  --input data/input/match.mp4 \
  --output data/output \
  --model yolov8n.pt \
  --device auto \
  --imgsz 640 \
  --skip 1
```

M2 MacBook Air에서 느리면 아래처럼 낮춰서 시작합니다.

```sh
python -m soccer_ai_mvp.cli \
  --input data/input/match.mp4 \
  --output data/output \
  --model yolov8n.pt \
  --device auto \
  --imgsz 480 \
  --skip 2
```

## 실행 옵션

```text
--input       입력 영상 경로
--output      결과 저장 폴더
--config      설정 YAML 경로
--model       YOLO 모델 파일 또는 모델명
--device      auto, mps, cpu
--imgsz       YOLO 입력 크기
--skip        N프레임마다 1번 분석
--max-frames  테스트용 최대 처리 프레임, 0이면 전체
```

## 웹 프로토타입 보기

브라우저 UI 프로토타입은 `web_prototype/`에 있습니다.

```sh
cd /Users/guest-dangn/soccer_ai_mvp/web_prototype
python3 -m http.server 8080
```

브라우저에서 엽니다.

```text
http://localhost:8080
```

웹 프로토타입은 좌표계, 2D 피치 모델, 카메라 가시 영역, 추정 선수 표시를 빠르게 확인하기 위한 UI입니다. 실제 분석 파이프라인은 Python 코드가 담당합니다.

중요: 웹 프로토타입은 브라우저에서 YOLO를 직접 실행하지 않습니다. 가짜로 움직이는 예시 `person`도 제거했습니다. 웹에서 사람 박스와 미니맵을 보려면 먼저 Python 분석을 실행해 `data/output/tracks.csv`를 만든 뒤, 웹 화면의 `tracks.csv 불러오기`에서 해당 파일을 선택해야 합니다.

전체 흐름은 아래 순서입니다.

```sh
source .venv/bin/activate
python -m soccer_ai_mvp.cli \
  --input data/input/match.mp4 \
  --output data/output \
  --model yolov8n.pt \
  --device auto \
  --imgsz 640 \
  --skip 1
```

그 다음 웹에서 `data/output/tracks.csv`를 불러옵니다.

## Homography 계획

현재 `homography.py`는 화면 좌표를 피치 좌표로 바꾸는 구조를 제공합니다. MVP에서는 기본적으로 화면 비율을 `105 x 68m` 피치에 매핑합니다.

후속 단계에서는 다음 방식으로 개선합니다.

1. 영상 첫 프레임에서 흰 선 기준점 4~8개를 수동 클릭합니다.
2. 클릭한 이미지 좌표와 실제 피치 좌표를 매칭합니다.
3. OpenCV `findHomography`로 변환 행렬을 계산합니다.
4. `configs/default.yaml`의 `homography.matrix`에 저장합니다.
5. 선수 bbox 하단 중앙, 즉 발 위치를 피치 좌표로 변환합니다.

## 성능 전략

- 처음에는 720p 또는 1080p 영상 파일 분석부터 시작합니다.
- 4K 실시간 분석은 초기 목표가 아닙니다.
- `yolov8n.pt`, `imgsz=480~640`, `skip=1~3` 조합으로 속도를 조절합니다.
- 결과 영상 생성이 실시간보다 우선입니다.
- 나중에 Jetson 또는 외부 GPU로 확장할 수 있도록 분석 로직을 모듈 단위로 분리했습니다.

## 후속 개발 목록

- 수동 homography 기준점 클릭 도구
- 공 전용 YOLO 모델 추가
- 팀 색상 분류 개선
- 등번호 OCR
- 선수 이름/포지션 매칭
- 히트맵, 활동 반경, 스프린트/압박 지표
- 인스타 업로드용 짧은 하이라이트 렌더링
- Jetson Orin Nano 배포 모드

## 참고 문서

- PyTorch MPS: https://docs.pytorch.org/docs/stable/notes/mps
- Ultralytics YOLO: https://docs.ultralytics.com/
- Ultralytics tracking: https://github.com/ultralytics/ultralytics/blob/main/docs/en/modes/track.md
