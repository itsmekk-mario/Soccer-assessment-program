from __future__ import annotations

from pathlib import Path

import pandas as pd


def write_outputs(rows: list[dict], output_dir: Path, video_path: Path, model_name: str, device: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "tracks.csv"
    report_path = output_dir / "report.md"

    df = pd.DataFrame(rows)
    df.to_csv(csv_path, index=False)

    total_frames = int(df["frame"].max()) + 1 if not df.empty else 0
    visible = int((df["status"] == "visible").sum()) if not df.empty else 0
    lost = int((df["status"] == "lost").sum()) if not df.empty else 0
    out = int((df["status"] == "out_of_view").sum()) if not df.empty else 0
    unique_ids = int(df["track_id"].nunique()) if not df.empty else 0

    report = f"""# 경기 분석 리포트

## 입력

- 영상: `{video_path}`
- 모델: `{model_name}`
- 장치: `{device}`

## 요약

- 처리 프레임: {total_frames}
- 추적 ID 수: {unique_ids}
- visible 기록 수: {visible}
- lost 기록 수: {lost}
- out_of_view 기록 수: {out}

## 산출물

- 결과 영상: `annotated.mp4`
- 추적 CSV: `tracks.csv`

## 해석 주의

이 MVP는 선수 검출과 ID 유지 구조를 확인하기 위한 첫 버전입니다. 화면 밖 선수 위치는 정확한 좌표가 아니라 마지막 관측 위치와 상태 전이를 기반으로 한 저신뢰 추정입니다.
"""
    report_path.write_text(report, encoding="utf-8")

