from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2

from .homography import compute_homography


LANDMARKS = [
    ("center_mark", [52.5, 34.0], "센터 마크"),
    ("center_circle_top", [52.5, 24.85], "센터서클 위쪽과 하프라인 교차"),
    ("center_circle_bottom", [52.5, 43.15], "센터서클 아래쪽과 하프라인 교차"),
    ("center_circle_left", [43.35, 34.0], "센터서클 왼쪽 끝"),
    ("center_circle_right", [61.65, 34.0], "센터서클 오른쪽 끝"),
    ("right_penalty_top", [88.5, 13.84], "오른쪽 페널티박스 위쪽 모서리"),
    ("right_penalty_bottom", [88.5, 54.16], "오른쪽 페널티박스 아래쪽 모서리"),
    ("left_penalty_top", [16.5, 13.84], "왼쪽 페널티박스 위쪽 모서리"),
    ("left_penalty_bottom", [16.5, 54.16], "왼쪽 페널티박스 아래쪽 모서리"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="축구장 흰선 기준 homography 보정 파일 생성")
    parser.add_argument("--input", required=True, help="입력 영상 경로")
    parser.add_argument("--output", required=True, help="저장할 calibration.json 경로")
    parser.add_argument("--frame", type=int, default=300, help="기준점 클릭에 사용할 프레임 번호")
    parser.add_argument("--scale", type=float, default=0.55, help="클릭 창 표시 배율")
    return parser.parse_args()


def grab_frame(video_path: Path, frame_index: int):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"영상을 열 수 없습니다: {video_path}")
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"{frame_index}번 프레임을 읽지 못했습니다.")
    return frame


def main() -> None:
    args = parse_args()
    video_path = Path(args.input)
    output_path = Path(args.output)
    frame = grab_frame(video_path, args.frame)

    points: list[dict] = []
    scaled = cv2.resize(frame, None, fx=args.scale, fy=args.scale, interpolation=cv2.INTER_AREA)
    window_name = "Soccer pitch calibration"
    current_index = 0

    def redraw() -> None:
        canvas = scaled.copy()
        for item in points:
            x = int(item["image"][0] * args.scale)
            y = int(item["image"][1] * args.scale)
            cv2.circle(canvas, (x, y), 6, (0, 255, 255), -1)
            cv2.putText(canvas, item["name"], (x + 8, y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0, 255, 255), 1, cv2.LINE_AA)

        if current_index < len(LANDMARKS):
            _, _, label = LANDMARKS[current_index]
            text = f"Click: {label} | u=undo, s=save, q=quit"
        else:
            text = "Enough points. Press s to save, u=undo, q=quit"
        cv2.rectangle(canvas, (0, 0), (canvas.shape[1], 34), (0, 0, 0), -1)
        cv2.putText(canvas, text, (12, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.imshow(window_name, canvas)

    def on_mouse(event, x, y, _flags, _param) -> None:
        nonlocal current_index
        if event != cv2.EVENT_LBUTTONDOWN or current_index >= len(LANDMARKS):
            return
        name, pitch, _label = LANDMARKS[current_index]
        points.append({"name": name, "image": [x / args.scale, y / args.scale], "pitch": pitch})
        current_index += 1
        redraw()

    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(window_name, on_mouse)
    redraw()

    while True:
        key = cv2.waitKey(20) & 0xFF
        if key == ord("q"):
            break
        if key == ord("u") and points:
            points.pop()
            current_index = max(0, current_index - 1)
            redraw()
        if key == ord("s"):
            if len(points) < 4:
                print("최소 4개 기준점을 찍어야 저장할 수 있습니다.")
                continue
            image_points = [item["image"] for item in points]
            pitch_points = [item["pitch"] for item in points]
            matrix = compute_homography(image_points, pitch_points)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with output_path.open("w", encoding="utf-8") as handle:
                json.dump(
                    {
                        "source": str(video_path),
                        "frame": args.frame,
                        "pitch_length_m": 105.0,
                        "pitch_width_m": 68.0,
                        "points": points,
                        "image_points": image_points,
                        "pitch_points": pitch_points,
                        "matrix": matrix,
                    },
                    handle,
                    ensure_ascii=False,
                    indent=2,
                )
            print(f"저장 완료: {output_path}")
            break

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
